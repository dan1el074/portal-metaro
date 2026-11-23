-- Dados locais de demonstracao. Não é carregado em produção.
INSERT INTO tb_param (id, name, content) VALUES (1, 'memorandoCount', '174');

INSERT INTO tb_post (content, is_warning, created_at, updated_at) VALUES ('<strong>Sobre nossa energia emocional:</strong><br><strong>- Gratidão:</strong> Aprecie as qualidades dos outros e veja o lado bom em cada situação. Seja grato por tudo e todos, sempre fazendo o que é certo!<br><strong>- Ambiente estimulante: </strong> Crie um ambiente leve, positivo e criativo. Para nós, é essencial trabalharmos em um lugar agradável!<br><strong>- Franqueza: </strong> Aja com franqueza e mostre seus sentimentos de maneira aberta e amigável!<br>Nós acreditamos que estamos criando a melhor empresa para se trabalhar! 🚀', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO tb_post (content, is_warning, created_at, updated_at) VALUES ('Hoje é o <strong>Dia da Família</strong>, e queremos lembrar que ela vai muito além dos laços de sangue. Família é onde encontramos apoio, afeto, cuidado e verdade.<br><br>Feliz Dia da Família!<br>Equipe Metaro.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO tb_post (content, is_warning, created_at, updated_at) VALUES ('', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO tb_post (content, is_warning, created_at, updated_at) VALUES ('Hoje à tarde o RH juntamente com os gestores da área (Chailan e Diogo), conduziram a primeira etapa do processo seletivo de Recrutamento Interno para a vaga de líder de produção.', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1768850938328_1', 'C:\\workspace\\outros\\imagens\\1768850938328_1.jpg', 'PROFILE', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1774469447392_2', 'C:\\workspace\\outros\\imagens\\1774469447392_2.png', 'PROFILE', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1768478302771_3', 'C:\\workspace\\outros\\imagens\\1768478302771_3.jpg', 'PROFILE', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1774469447392_4', 'C:\\workspace\\outros\\imagens\\1774469447392_4.jpg', 'PROFILE', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1768478289921_5', 'C:\\workspace\\outros\\imagens\\1768478289921_5.jpg', 'PROFILE', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1768478289921_6', 'C:\\workspace\\outros\\imagens\\1774469447367_6.webp', 'EVENT', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00001', 'C:\\workspace\\outros\\imagens\\img_00001.jpg', 'POST', 4);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00002', 'C:\\workspace\\outros\\imagens\\img_00002.jpg', 'POST', 4);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00003', 'C:\\workspace\\outros\\imagens\\img_00003.jpg', 'POST', 4);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00004', 'C:\\workspace\\outros\\imagens\\img_00004.jpg', 'POST', 4);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00005', 'C:\\workspace\\outros\\imagens\\img_00005.jpg', 'EVENT', NULL);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00006', 'C:\\workspace\\outros\\imagens\\img_00006.jpeg', 'POST', 2);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00007', 'C:\\workspace\\outros\\imagens\\img_00007.jpeg', 'POST', 3);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('img_00008', 'C:\\workspace\\outros\\imagens\\img_00008.jpeg', 'POST', 1);
INSERT INTO tb_picture (name, path, type, post_id) VALUES ('1785570347278_1', 'C:\\workspace\\outros\\imagens\\1785570347278_1.jpg', 'EVENT', NULL);

INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (1, 'TI', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (2, 'Compras', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (3, 'Recursos Humanos', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (4, 'Marketing', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (5, 'Engenharia', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (6, 'Qualidade', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (7, 'PCP', true, true, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (8, 'Comercial', false, true, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (9, 'Produção', true, false, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (10, 'Almoxarifado', true, true, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (11, 'Montagem Final', true, true, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');
INSERT INTO tb_position (id, name, activated, is_locked, updated_at, created_at) VALUES (19, 'Financeiro', true, true, TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z', TIMESTAMP WITH TIME ZONE '2026-02-23T15:00:00Z');

INSERT INTO tb_user (name, email, position_id, birth_date, picture_id, activated, username, password, created_at, update_at, support_token) VALUES ('Daniel Vargas', 'daniel.vargas@metaro.com.br', 1, '1999-08-08', 1, true, 'daniel-vargas','$2a$10$/38.DeKTEvwu4eCpOAe0GO298DNA7fXWvdPXDPMHe0bu/j53j5bA2', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', null);
INSERT INTO tb_user (name, email, position_id, birth_date, picture_id, activated, username, password, created_at, update_at, support_token) VALUES ('Enzo Bazzi', 'enzo.bazzi@metaro.com.br', 1, '2003-08-09', 2, true, 'enzo-bazzi','$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ8tG', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', null);
INSERT INTO tb_user (name, email, position_id, birth_date, picture_id, activated, username, password, created_at, update_at, support_token) VALUES ('Aline Moterle', 'rh@metaro.com.br', 3, '1987-11-25', 3, true, 'aline-moterle','$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ8tG', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', null);
INSERT INTO tb_user (name, email, position_id, birth_date, picture_id, activated, username, password, created_at, update_at, support_token) VALUES ('Carlos Fronza', 'carlos.fronza@metaro.com.br', 2, '1820-08-13', 4, true, 'carlos-fronza','$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ8tG', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', 'uTz4Ch9QFCq120pnAmMAU0eXgEC14MHkY0TnNdIu');
INSERT INTO tb_user (name, email, position_id, birth_date, picture_id, activated, username, password, created_at, update_at, support_token) VALUES ('Juliano Bortoletti', 'marketing@metaro.com.br', 4, '1987-11-25', 5, true, 'juliano-bortoletti','$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ8tG', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', null);
INSERT INTO tb_user (name, email, position_id, birth_date, picture_id, activated, username, password, created_at, update_at, support_token) VALUES ('Luana Kohlrausch', 'luana.k@metaro.com.br', 3, '1998-07-14', null, true, 'luana-kohlrausch','$2a$10$eACCYoNOHEqXve8aIWT8Nu3PkMXWBaOxJ9aORUYzfMQCbVBIhZ8tG', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', TIMESTAMP WITH TIME ZONE '2022-07-25T15:00:00Z', null);

UPDATE tb_post SET user_id = 3 WHERE id = 1;
UPDATE tb_post SET user_id = 3 WHERE id = 2;
UPDATE tb_post SET user_id = 5 WHERE id = 3;
UPDATE tb_post SET user_id = 3 WHERE id = 4;

INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (1, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (2, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (2, 4);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (3, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (4, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (4, 5);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (5, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (6, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (7, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (8, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (9, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (10, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (11, 1);
INSERT INTO tb_position_manangers (position_id, mananger_id) VALUES (19, 1);

INSERT INTO tb_role (authority) VALUES ('ROLE_USER');
INSERT INTO tb_role (authority) VALUES ('ROLE_ADMIN');
INSERT INTO tb_role (authority, title, title_url, parent, parent_url) VALUES ('ROLE_ADM_PANEL', 'Usuários', '/users', 'Administração','/administration');
INSERT INTO tb_role (authority, title, title_url, parent, parent_url) VALUES ('ROLE_POSITION_PANEL', 'Departamentos', '/departments', 'Administração','/administration');
INSERT INTO tb_role (authority, title, title_url, parent, parent_url) VALUES ('ROLE_RAW_MATERIALS', 'Matérias primas', '/raw-materials', 'Geral','/general');
INSERT INTO tb_role (authority, title, title_url, parent, parent_url) VALUES ('ROLE_MEMORANDO', 'Memorando', '/memorando', 'Geral', '/general');
INSERT INTO tb_role (authority, title, parent) VALUES ('ROLE_POST', 'Postagens', 'Administração');
INSERT INTO tb_role (authority, title, title_url, parent, parent_url) VALUES ('ROLE_STEP_FLOW', 'Fluxo de etapas', '/step-flow', 'Geral', '/general');
INSERT INTO tb_role (authority, title, parent, father_id) VALUES ('ROLE_STEP_FLOW_ADMIN', 'Fluxo de etapas - Admin', 'Geral', 8);

INSERT INTO tb_user_role (user_id, role_id) VALUES (1,2);
INSERT INTO tb_user_role (user_id, role_id) VALUES (2,1);
INSERT INTO tb_user_role (user_id, role_id) VALUES (2,5);
INSERT INTO tb_user_role (user_id, role_id) VALUES (2,6);
INSERT INTO tb_user_role (user_id, role_id) VALUES (2,8);
INSERT INTO tb_user_role (user_id, role_id) VALUES (3,1);
INSERT INTO tb_user_role (user_id, role_id) VALUES (3,3);
INSERT INTO tb_user_role (user_id, role_id) VALUES (3,4);
INSERT INTO tb_user_role (user_id, role_id) VALUES (3,7);
INSERT INTO tb_user_role (user_id, role_id) VALUES (4,1);
INSERT INTO tb_user_role (user_id, role_id) VALUES (4,5);
INSERT INTO tb_user_role (user_id, role_id) VALUES (4,6);
INSERT INTO tb_user_role (user_id, role_id) VALUES (5,1);
INSERT INTO tb_user_role (user_id, role_id) VALUES (5,7);
INSERT INTO tb_user_role (user_id, role_id) VALUES (6,1);
INSERT INTO tb_user_role (user_id, role_id) VALUES (6,3);
INSERT INTO tb_user_role (user_id, role_id) VALUES (6,4);
INSERT INTO tb_user_role (user_id, role_id) VALUES (6,7);

INSERT INTO tb_notification (message, action_url, viewed, auto_delete, type, reference_id, created_at, user_id) VALUES ('teste', null, false, true, 'MEMORANDO_FINISH', null, NOW(), 1);
INSERT INTO tb_notification (message, action_url, viewed, auto_delete, type, reference_id, created_at, user_id) VALUES ('teste', null, false, true, 'MEMORANDO_FINISH', null, NOW(), 1);
INSERT INTO tb_notification (message, action_url, viewed, auto_delete, type, reference_id, created_at, user_id) VALUES ('teste', null, false, true, 'MEMORANDO_FINISH', null, NOW(), 1);
INSERT INTO tb_notification (message, action_url, viewed, auto_delete, type, reference_id, created_at, user_id) VALUES ('teste', null, false, true, 'MEMORANDO_FINISH', null, NOW(), 1);

INSERT INTO tb_file (id, title, file_name, created_at) VALUES (1, 'Manifesto', 'manifesto.png', CURRENT_TIMESTAMP);
INSERT INTO tb_file (id, title, file_name, created_at) VALUES (2, 'Lista de ramais', 'ramais.pdf', CURRENT_TIMESTAMP);
INSERT INTO tb_file (id, title, file_name, created_at) VALUES (3, 'Memorando', 'manual-memorando.pdf', CURRENT_TIMESTAMP);

INSERT INTO tb_event (title, picture_id, event_date, created_at, updated_at) VALUES ('Minuto da Qualidade', 6, TIMESTAMP WITH TIME ZONE '2036-08-14T20:15:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO tb_event (title, picture_id, event_date, created_at, updated_at) VALUES ('SIPAT - Pav 4', 11, TIMESTAMP WITH TIME ZONE '2036-08-21T20:15:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
