-- Historical titles must use each flow's frozen template, not the current model.
-- This helper exists only for this data update and is removed below.
CREATE FUNCTION migration_v26_checklist_title(
    p_plan JSONB, p_template_id BIGINT, p_answers JSONB, p_created_label TEXT,
    p_record_id BIGINT, p_serial TEXT, p_order TEXT, p_client TEXT, p_item TEXT, p_seller TEXT
) RETURNS TEXT
LANGUAGE plpgsql
AS $function$
DECLARE
    snapshot JSONB;
    section JSONB;
    question JSONB;
    tokens JSONB;
    section_index INTEGER := 0;
    question_index INTEGER;
    field_id TEXT;
    answer_value TEXT;
    expression TEXT;
    remaining TEXT;
    rendered TEXT := '';
    token TEXT;
    token_position INTEGER;
BEGIN
    SELECT step -> 'template' INTO snapshot
    FROM jsonb_array_elements(p_plan) AS step
    WHERE step -> 'template' ->> 'id' = p_template_id::TEXT
    LIMIT 1;

    IF snapshot IS NULL THEN
        RAISE EXCEPTION 'Modelo % ausente no fluxo do checklist %.', p_template_id, p_record_id;
    END IF;

    tokens := jsonb_build_object(
        '%data', p_created_label, '{data}', p_created_label,
        '%serie', p_serial, '%pedido', p_order, '%cliente', p_client,
        '%item', p_item, '%vendedor', p_seller
    );

    FOR section IN SELECT value FROM jsonb_array_elements(COALESCE(snapshot -> 'sections', '[]'::JSONB))
    LOOP
        section_index := section_index + 1;
        question_index := 0;
        FOR question IN SELECT value FROM jsonb_array_elements(COALESCE(section -> 'questions', '[]'::JSONB))
        LOOP
            question_index := question_index + 1;
            field_id := question -> 'fields' -> 0 ->> 'id';
            answer_value := COALESCE(p_answers -> (question ->> 'id') -> 'fields' ->> field_id, '');
            tokens := tokens || jsonb_build_object(
                '%' || section_index || '.' || question_index, answer_value,
                '{' || (question ->> 'id') || '}', answer_value
            );
        END LOOP;
    END LOOP;

    expression := COALESCE(snapshot ->> 'title', '');
    remaining := expression;
    -- Consume the original expression once. Values containing tokens, '$' or '\'
    -- remain literal, matching the application renderer.
    FOR token IN SELECT (regexp_matches(expression, '(%(?:data|serie|pedido|cliente|item|vendedor|[0-9]+\.[0-9]+)|\{[^}]+\})', 'g'))[1]
    LOOP
        token_position := strpos(remaining, token);
        rendered := rendered || left(remaining, token_position - 1)
            || COALESCE(NULLIF(tokens ->> token, ''), '.');
        remaining := substring(remaining FROM token_position + length(token));
    END LOOP;
    rendered := btrim(rendered || remaining);

    IF rendered = '' THEN
        RETURN COALESCE(snapshot ->> 'name', '') || ' · ' || p_record_id;
    END IF;
    RETURN rendered;
END;
$function$;

UPDATE tb_checklist_record r
SET listing_title = migration_v26_checklist_title(
    f.plan_json::JSONB, r.template_id,
    CASE WHEN r.status = 'JUSTIFIED' THEN '{}'::JSONB ELSE COALESCE(r.answers_json, '{}')::JSONB END,
    to_char(r.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY, HH24:MI:SS'),
    r.id, f.serial_number, f.order_number, f.client_name, f.commercial_item, f.salesperson
)
FROM tb_checklist_flow f
WHERE f.id = r.flow_id;

DROP FUNCTION migration_v26_checklist_title(JSONB, BIGINT, JSONB, TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT);
