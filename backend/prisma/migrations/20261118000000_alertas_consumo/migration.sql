-- AlterTable
ALTER TABLE "cliente" ADD COLUMN     "alerta_diario_em" DATE,
ADD COLUMN     "alerta_mensal_em" DATE,
ADD COLUMN     "limite_diario_brl" DECIMAL(12,2),
ADD COLUMN     "limite_mensal_brl" DECIMAL(12,2);

