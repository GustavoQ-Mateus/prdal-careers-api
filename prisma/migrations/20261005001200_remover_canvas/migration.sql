ALTER TABLE "pipeline_layouts" DROP CONSTRAINT "pipeline_layouts_usuario_id_fkey";

ALTER TABLE "pipeline_layouts" DROP CONSTRAINT "pipeline_layouts_vaga_id_fkey";

ALTER TABLE "preferencias_usuario" DROP COLUMN "canvas_revisao",
DROP COLUMN "canvas_x",
DROP COLUMN "canvas_y",
DROP COLUMN "canvas_zoom";

DROP TABLE "pipeline_layouts";
