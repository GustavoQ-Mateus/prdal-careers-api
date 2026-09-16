import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const EMAIL = 'gustavoq.mateusgithub@gmail.com';
const AI = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const API_CONTAINER = 'prdal-careers-api-1';
const USUARIO_ID_FALLBACK = '9b624a85-5931-4552-b251-0f8ed6f8f44c';

const LOTES = [
  {
    raiz: 'F:/geracurriculo/curriculos/arquivo/2026-09-04_limpeza',
    data: new Date('2026-09-04T16:00:00-03:00'),
  },
  {
    raiz: 'F:/geracurriculo/curriculos/arquivo/2026-09-06_limpeza',
    data: new Date('2026-09-06T01:00:00-03:00'),
  },
  {
    raiz: 'F:/geracurriculo/curriculos/arquivo/2026-09-09_limpeza',
    data: new Date('2026-09-09T17:00:00-03:00'),
  },
  {
    raiz: 'F:/geracurriculo/curriculos',
    data: new Date('2026-09-12T23:00:00-03:00'),
  },
];

const prisma = new PrismaClient();

function listarArquivos(dir, ext) {
  if (!existsSync(dir)) return [];
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const cheio = path.join(dir, nome);
    const st = statSync(cheio);
    if (st.isDirectory()) saida.push(...listarArquivos(cheio, ext));
    else if (nome.toLowerCase().endsWith(ext)) saida.push(cheio);
  }
  return saida;
}

function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function campo(md, rotulo) {
  const re = new RegExp(`^\\*\\*?${rotulo}\\*\\*?\\s*:\\s*(.+)$`, 'im');
  const m = md.match(re) || md.match(new RegExp(`^${rotulo}\\s*:\\s*(.+)`, 'im'));
  return m ? m[1].replace(/\*+/g, '').trim() : null;
}

function parseVaga(arquivo, loteData) {
  const md = readFileSync(arquivo, 'utf8');
  const slug = path.basename(arquivo, '.md');
  const h1 = md.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? slug;
  const partes = h1.split(/\s+[—–-]\s+/);
  let empresa = campo(md, 'Empresa');
  let titulo = h1;
  if (!empresa && partes.length >= 2) {
    const esquerda = partes[0].trim();
    const direita = partes.slice(1).join(' - ').trim();
    if (/desenvolvedor|engineer|analista|estagio|fullstack|backend|frontend/i.test(esquerda)) {
      titulo = esquerda;
      empresa = direita.replace(/[()·].*$/, '').trim();
    } else {
      empresa = esquerda.replace(/[()·].*$/, '').trim();
      titulo = direita;
    }
  }
  empresa = (empresa || slug.split('_')[0]).replace(/\s+/g, ' ').trim();
  const fonte = campo(md, 'Fonte') || campo(md, 'Candidatura') || null;
  const fonteUrl = fonte?.match(/https?:\/\/\S+/)?.[0] ?? fonte;
  return {
    slug,
    arquivo,
    titulo: titulo.slice(0, 180),
    empresa: empresa.slice(0, 120),
    descricao: md,
    fonte: fonteUrl,
    data: loteData,
  };
}

function chaveVaga(vaga) {
  return `${normalizar(vaga.empresa)}|${normalizar(vaga.titulo)}`;
}

function pontuarMatch(vaga, cvPath) {
  const alvo = normalizar(path.relative('F:/geracurriculo', cvPath));
  const nome = normalizar(path.basename(cvPath, '.md'));
  if (nome.includes('linkedin') || nome.includes('gupymaster')) return 0;
  const tokens = vaga.slug.split(/[_-]+/).filter((t) => t.length >= 4);
  if (tokens.length === 0) return 0;
  let pontos = 0;
  if (alvo.includes(normalizar(tokens[0]))) pontos += 6;
  if (alvo.includes(normalizar(vaga.empresa))) pontos += 4;
  for (const token of tokens.slice(1)) {
    if (alvo.includes(normalizar(token))) pontos += 1;
  }
  if (nome.startsWith('curriculo')) pontos += 2;
  else if (nome.startsWith('resume')) pontos += 1;
  return pontos;
}

function irmao(mdPath, ext) {
  const dir = path.dirname(mdPath);
  const base = path.basename(mdPath, '.md');
  const direto = path.join(dir, `${base}.${ext}`);
  if (existsSync(direto)) return direto;
  const candidatos = readdirSync(dir).filter(
    (n) => n.toLowerCase().endsWith(`.${ext}`) && normalizar(n).includes(normalizar(base).slice(0, 18)),
  );
  return candidatos[0] ? path.join(dir, candidatos[0]) : null;
}

async function classificar(titulo, descricao) {
  try {
    const res = await fetch(`${AI}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titulo, descricao: descricao.slice(0, 8000) }),
    });
    if (!res.ok) return { categoria: null, nivel: null };
    return res.json();
  } catch {
    return { categoria: null, nivel: null };
  }
}

function keywordsLocais(descricao) {
  const termos = [
    'python', 'typescript', 'javascript', 'java', 'node', 'nestjs', 'react',
    'next', 'angular', 'fastapi', 'spring', 'dotnet', 'c#', 'postgresql',
    'mongodb', 'mysql', 'redis', 'docker', 'kubernetes', 'aws', 'azure',
    'gcp', 'terraform', 'github actions', 'jwt', 'rest', 'graphql', 'llm',
    'rag', 'ia', 'ci/cd', 'tailwind', 'prisma',
  ];
  const texto = descricao.toLowerCase();
  const achados = termos.filter((t) => texto.includes(t));
  const pesos = achados.map((termo, i) => ({
    termo,
    peso: Number((1 - i * 0.04).toFixed(2)),
  }));
  return pesos.slice(0, 15);
}

function perfilBase() {
  return {
    nome: 'Gustavo Queiroz Mateus',
    contato: {
      email: 'gustavoqueirozunifor@edu.unifor.br',
      telefone: '+55 85 99120-7171',
      linkedin: 'https://linkedin.com/in/gustavo-queiroz-mateus-935255283',
      github: 'https://github.com/GustavoQ-Mateus',
      cidade: 'Fortaleza, CE',
    },
    resumo:
      'Desenvolvedor full-stack com experiencia pratica em sistemas web e aplicacoes corporativas em producao, cobrindo o ciclo do requisito ao deploy. Constroi APIs REST com Python (FastAPI), Node.js/NestJS, Java (Spring Boot) e C#/.NET, e interfaces com React, Next.js, TypeScript e Angular.',
    experiencias: [
      'Modera Road Inspector | Desenvolvedor Full-Stack | 06/2026 - atual | plataforma de inspecao de pavimento com React 18, FastAPI, YOLO, AWS e Terraform.',
      'Saraiva Leao | Desenvolvedor Full-Stack | 03/2025 - atual | ERP/CRM com 13 modulos em FastAPI, React, TypeScript e MySQL, agente de IA e WhatsApp.',
      'Micro&Money | Estagio Full-Stack | 01/2026 - 04/2026 | ERP e APIs com Node.js, NestJS, React, Angular e Spring Boot.',
    ],
    formacao: [
      'UNIFOR - Tecnologo em Analise e Desenvolvimento de Sistemas | 02/2025 - 06/2027 | PMG 9.4',
    ],
    skills: [
      'Python', 'TypeScript', 'Java', 'C#', 'FastAPI', 'NestJS', 'Spring Boot',
      '.NET', 'React', 'Next.js', 'PostgreSQL', 'Docker', 'AWS', 'Terraform',
      'RAG', 'LLMs',
    ],
  };
}

function copiarStorage(origem, destinoNome) {
  if (!origem || !existsSync(origem)) return null;
  execFileSync('docker', ['cp', origem, `${API_CONTAINER}:/app/storage/${destinoNome}`]);
  return `/app/storage/${destinoNome}`;
}

async function main() {
  const usuario =
    (await prisma.usuario.findUnique({ where: { email: EMAIL } })) ??
    (await prisma.usuario.findUnique({ where: { id: USUARIO_ID_FALLBACK } }));
  if (!usuario) throw new Error(`usuario nao encontrado: ${EMAIL}`);

  await prisma.perfilMestre.upsert({
    where: { usuarioId: usuario.id },
    update: perfilBase(),
    create: { usuarioId: usuario.id, ...perfilBase() },
  });
  await prisma.preferenciaUsuario.upsert({
    where: { usuarioId: usuario.id },
    update: { fusoHorario: 'America/Fortaleza' },
    create: { usuarioId: usuario.id, fusoHorario: 'America/Fortaleza' },
  });

  const vagas = [];
  const vistos = new Set();
  for (const lote of LOTES) {
    const pasta = path.join(lote.raiz, 'vagas');
    for (const arquivo of listarArquivos(pasta, '.md')) {
      const vaga = parseVaga(arquivo, lote.data);
      const chave = chaveVaga(vaga);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      vagas.push({ ...vaga, loteRaiz: lote.raiz });
    }
  }

  const cvs = LOTES.flatMap((lote) =>
    listarArquivos(path.join(lote.raiz, 'output'), '.md').map((arquivo) => ({
      arquivo,
      loteRaiz: lote.raiz,
    })),
  );

  let criadas = 0;
  let comCv = 0;
  for (const vaga of vagas) {
    const existente = await prisma.vaga.findFirst({
      where: { usuarioId: usuario.id, titulo: vaga.titulo, empresa: vaga.empresa },
    });
    if (existente) continue;

    const { categoria, nivel } = await classificar(vaga.titulo, vaga.descricao);
    const keywords = keywordsLocais(vaga.descricao);
    const vagaId = randomUUID();
    const origemHash = createHash('sha1').update(vaga.arquivo).digest('hex').slice(0, 24);

    const candidatos = cvs
      .map((cv) => ({ ...cv, pontos: pontuarMatch(vaga, cv.arquivo) }))
      .filter((cv) => cv.pontos >= 6)
      .sort((a, b) => {
        const mesmoLote = Number(b.loteRaiz === vaga.loteRaiz) - Number(a.loteRaiz === vaga.loteRaiz);
        return mesmoLote !== 0 ? mesmoLote : b.pontos - a.pontos;
      });
    const cv = candidatos[0];

    await prisma.$transaction(async (tx) => {
      await tx.vaga.create({
        data: {
          id: vagaId,
          usuarioId: usuario.id,
          titulo: vaga.titulo,
          empresa: vaga.empresa,
          descricao: vaga.descricao,
          fonte: vaga.fonte,
          keywords,
          categoria,
          nivel,
          origem: 'IMPORTACAO',
          origemImportacaoId: origemHash,
          criadoEm: vaga.data,
          atualizadoEm: vaga.data,
        },
      });
      await tx.eventoOportunidade.create({
        data: {
          usuarioId: usuario.id,
          vagaId,
          tipo: 'OPORTUNIDADE_CRIADA',
          origem: 'SISTEMA',
          descricao: 'Oportunidade importada do geracurriculo',
          dados: { arquivo: vaga.slug },
          ocorridoEm: vaga.data,
        },
      });

      let curriculoId = null;
      if (cv) {
        curriculoId = randomUUID();
        const markdown = readFileSync(cv.arquivo, 'utf8');
        const docxOrig = irmao(cv.arquivo, 'docx');
        const pdfOrig = irmao(cv.arquivo, 'pdf');
        const docxPath = copiarStorage(docxOrig, `${curriculoId}.docx`);
        const pdfPath = copiarStorage(pdfOrig, `${curriculoId}.pdf`);
        await tx.curriculo.create({
          data: {
            id: curriculoId,
            vagaId,
            rotulo: 'Versao importada',
            markdown,
            docxPath,
            pdfPath,
            geradoEm: vaga.data,
          },
        });
        await tx.eventoOportunidade.create({
          data: {
            usuarioId: usuario.id,
            vagaId,
            curriculoId,
            tipo: 'CURRICULO_GERADO',
            origem: 'SISTEMA',
            descricao: 'Curriculo importado do geracurriculo',
            dados: { arquivo: path.basename(cv.arquivo) },
            ocorridoEm: vaga.data,
          },
        });
        comCv += 1;
      }

      const candidaturaId = randomUUID();
      await tx.candidatura.create({
        data: {
          id: candidaturaId,
          vagaId,
          curriculoId,
          status: 'INSCRITA',
          principal: true,
          notas: 'Candidatura registrada no gerador ATS anterior.',
          enviadaEm: vaga.data,
          criadoEm: vaga.data,
          atualizadoEm: vaga.data,
        },
      });
      await tx.eventoOportunidade.create({
        data: {
          usuarioId: usuario.id,
          vagaId,
          candidaturaId,
          curriculoId,
          tipo: 'CANDIDATURA_CRIADA',
          origem: 'SISTEMA',
          descricao: 'Candidatura marcada como inscrita',
          dados: { status: 'INSCRITA' },
          ocorridoEm: vaga.data,
        },
      });
    });
    criadas += 1;
    process.stdout.write(`${criadas}. ${vaga.empresa} | ${vaga.titulo}${cv ? ' [cv]' : ''}\n`);
  }

  console.log(`Pronto: ${criadas} oportunidades, ${comCv} curriculos, usuario ${usuario.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
