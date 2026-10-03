const { randomUUID } = require('node:crypto');

function confere(registro, where = {}) {
  return Object.entries(where).every(([campo, condicao]) => {
    const valor = registro[campo];
    if (condicao === null) return valor === null || valor === undefined;
    if (condicao instanceof Date) return valor?.getTime() === condicao.getTime();
    if (condicao && typeof condicao === 'object') {
      if ('equals' in condicao) {
        return condicao.mode === 'insensitive'
          ? String(valor).toLowerCase() === String(condicao.equals).toLowerCase()
          : valor === condicao.equals;
      }
      if ('gt' in condicao) return valor > condicao.gt;
    }
    return valor === condicao;
  });
}

function prismaMemoria({ usuarios = [], sessoes = [] } = {}) {
  return {
    usuarios,
    sessoes,
    usuario: {
      findFirst: async ({ where }) => usuarios.find((u) => confere(u, where)) ?? null,
      findUnique: async ({ where }) => usuarios.find((u) => confere(u, where)) ?? null,
      create: async ({ data }) => {
        const usuario = { id: randomUUID(), criadoEm: new Date(), ...data };
        usuarios.push(usuario);
        return usuario;
      },
      update: async ({ where, data }) => {
        const usuario = usuarios.find((u) => confere(u, where));
        Object.assign(usuario, data);
        return usuario;
      },
    },
    sessao: {
      create: async ({ data }) => {
        const sessao = {
          id: randomUUID(),
          criadoEm: new Date(),
          ultimoUsoEm: null,
          substituidaEm: null,
          revogadaEm: null,
          ...data,
        };
        sessoes.push(sessao);
        return sessao;
      },
      findUnique: async ({ where, include }) => {
        const sessao = sessoes.find((s) => confere(s, where));
        if (!sessao) return null;
        if (!include?.usuario) return { ...sessao };
        const usuario = usuarios.find((u) => u.id === sessao.usuarioId);
        return { ...sessao, usuario: { id: usuario.id, email: usuario.email } };
      },
      updateMany: async ({ where, data }) => {
        const alvos = sessoes.filter((s) => confere(s, where));
        for (const s of alvos) Object.assign(s, data);
        return { count: alvos.length };
      },
      count: async ({ where }) => sessoes.filter((s) => confere(s, where)).length,
    },
  };
}

module.exports = { prismaMemoria };
