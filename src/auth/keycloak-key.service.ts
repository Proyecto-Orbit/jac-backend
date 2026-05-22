import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

@Injectable()
export class KeycloakKeyService {
  private readonly logger = new Logger(KeycloakKeyService.name);
  private cachedPublicKey?: string;
  private cachedAt = 0;

  async getPublicKey(): Promise<string> {
    if (this.cachedPublicKey && Date.now() - this.cachedAt < 10 * 60_000) {
      return this.cachedPublicKey;
    }

    const realmUrl = this.getRealmUrl();

    let response: Response;
    try {
      response = await fetch(realmUrl);
    } catch (error) {
      this.logger.error('Error consultando Keycloak', error as Error);
      throw new InternalServerErrorException('No se pudo obtener la clave pública de Keycloak');
    }

    if (!response.ok) {
      this.logger.error(`Keycloak devolvió ${response.status}`);
      throw new InternalServerErrorException('No se pudo obtener la clave pública de Keycloak');
    }

    const json = (await response.json()) as { public_key?: string };
    if (!json?.public_key) {
      this.logger.error('Keycloak no devolvió public_key en el endpoint del realm');
      throw new InternalServerErrorException('Respuesta inválida de Keycloak');
    }

    this.cachedPublicKey = this.formatPublicKey(json.public_key);
    this.cachedAt = Date.now();
    return this.cachedPublicKey;
  }

  private getRealmUrl(): string {
    const realmUrl = process.env.KEYCLOAK_REALM_URL?.trim();
    if (realmUrl) {
      return realmUrl.replace(/\/?$/, '');
    }

    const baseUrl = process.env.KEYCLOAK_URL?.trim();
    const realm = process.env.KEYCLOAK_REALM?.trim();
    if (!baseUrl || !realm) {
      throw new InternalServerErrorException(
        'KEYCLOAK_REALM_URL o KEYCLOAK_URL y KEYCLOAK_REALM deben estar configurados',
      );
    }

    return `${baseUrl.replace(/\/?$/, '')}/realms/${realm.replace(/^\/+|\/+$/g, '')}`;
  }

  private formatPublicKey(publicKey: string): string {
    const normalized = publicKey.replace(/\s+/g, '');
    const chunks = normalized.match(/.{1,64}/g) ?? [normalized];
    return ['-----BEGIN PUBLIC KEY-----', ...chunks, '-----END PUBLIC KEY-----'].join('\n');
  }
}
