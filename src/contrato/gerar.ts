import 'reflect-metadata';
import { Module, RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, INTERCEPTORS_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { NestFactory } from '@nestjs/core';
import { ApiExtraModels, ApiResponse, DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { configurarPrefixo } from '../config/prefixo';
import { eventosCopiloto, modelosResposta, respostasContrato } from './respostas.dto';

function controllers(pasta: string): Array<new (...args: any[]) => any> {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);
    if (entrada.isDirectory()) return controllers(caminho);
    if (!entrada.name.endsWith('.controller.js')) return [];
    return Object.values(require(caminho)).filter((valor): valor is new (...args: any[]) => any => typeof valor === 'function');
  });
}

export async function gerarContrato() {
  const classes = controllers(path.resolve(__dirname, '..'));
  const dependencias = new Set<any>();
  const metadados: Array<{ alvo: object; chave: string; valor: unknown }> = [];
  for (const classe of classes) {
    ApiExtraModels(...modelosResposta)(classe);
    for (const dependencia of Reflect.getMetadata('design:paramtypes', classe) ?? []) dependencias.add(dependencia);
    for (const alvo of [classe, ...Object.getOwnPropertyNames(classe.prototype).map((nome) => classe.prototype[nome])]) {
      for (const chave of [GUARDS_METADATA, INTERCEPTORS_METADATA]) {
        const valor = Reflect.getOwnMetadata(chave, alvo);
        if (valor) metadados.push({ alvo, chave, valor });
        Reflect.deleteMetadata(chave, alvo);
      }
    }
    for (const resposta of respostasContrato.filter((resposta) => resposta.controller === classe.name)) {
      const handler = classe.prototype[resposta.metodo];
      const status = Reflect.getMetadata(HTTP_CODE_METADATA, handler) ?? (Reflect.getMetadata(METHOD_METADATA, handler) === RequestMethod.POST ? 201 : 200);
      const descriptor = Object.getOwnPropertyDescriptor(classe.prototype, resposta.metodo)!;
      if (resposta.schema && status !== 204) ApiResponse({ status, schema: resposta.schema })(classe.prototype, resposta.metodo, descriptor);
    }
  }
  class ModuloContrato {}
  Module({ controllers: classes, providers: [...dependencias].map((provide) => ({ provide, useValue: {} })) })(ModuloContrato);
  let app;
  try {
    app = await NestFactory.create(ModuloContrato, { logger: false, abortOnError: false });
    configurarPrefixo(app, {});
    const documento = SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('prdal-careers-api').setVersion('1.3.0').addCookieAuth('prdal_access', undefined, 'prdal_access').build());
    documento.components!.schemas!.CopilotoEvento = eventosCopiloto;
    Object.assign(documento.paths['/v1/copiloto/chat'].post!, { 'x-eventos': { $ref: '#/components/schemas/CopilotoEvento' } });
    return documento;
  } finally {
    await app?.close();
    for (const { alvo, chave, valor } of metadados) Reflect.defineMetadata(chave, valor, alvo);
  }
}

export function serializarContrato(documento: unknown): string {
  function ordenar(valor: any): any {
    if (Array.isArray(valor)) return valor.map(ordenar);
    if (valor && typeof valor === 'object') return Object.fromEntries(Object.keys(valor).sort().map((chave) => [chave, ordenar(valor[chave])]));
    return valor;
  }
  return JSON.stringify(ordenar(documento), null, 2) + '\n';
}
