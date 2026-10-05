UPDATE "usuarios" SET "email" = lower(trim("email"));

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_email_minusculo_chk" CHECK ("email" = lower(trim("email")));
