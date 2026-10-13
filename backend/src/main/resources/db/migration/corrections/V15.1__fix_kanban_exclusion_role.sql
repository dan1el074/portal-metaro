UPDATE tb_role
SET authority = 'ROLE_KANBAN_EXCLUSION',
    title = 'Exclusão de Kanban',
    title_url = '/kanban-exclusion'
WHERE authority = 'ROLE_KANBAM_EXCLUSION';
