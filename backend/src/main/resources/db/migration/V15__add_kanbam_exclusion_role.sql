INSERT INTO tb_role (authority, title, title_url, parent, parent_url, activated)
SELECT 'ROLE_KANBAM_EXCLUSION', 'Exclusão de Kanbam', '/kanbam-exclusion', 'PCP', '/pcp', TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM tb_role
    WHERE authority = 'ROLE_KANBAM_EXCLUSION'
);
