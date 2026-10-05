CREATE TABLE "turnos_copiloto" (
    "conversa_id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_copiloto_pkey" PRIMARY KEY ("conversa_id")
);
