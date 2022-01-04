import * as _ from 'lodash';
import { Context, Utils } from '@verida/client-ts';
import EncryptionUtils from '@verida/encryption-utils';
import { ContextInterfaces } from '@verida/client-ts';

const PermissionOptionsEnum = ContextInterfaces.PermissionOptionsEnum;

/**
 *
 */

interface VCResult {
  item: any;
  result: any;
  did: string;
  uri: string;
}

const SCHEMAs = {
  encrypted: 'https://common.schemas.verida.io/credential/public/encrypted/v0.1.0/schema.json',
  default: 'https://common.schemas.verida.io/credential/public/default/v0.1.0/schema.json',
};

export default class SharingCredential {
  context: Context;

  constructor(context: Context) {
    this.context = context;
  }
  /**
   * Method to encrypt and issue credential
   * @param didJwtVc
   * @returns
   */

  async issueEncryptedCredential(item: any): Promise<any> {
    const account = this.context.getAccount();
    const did = await account.did();
    const encryptionKey = new Uint8Array(EncryptionUtils.randomKey(22));

    const contextName = this.context.getContextName();

    const result = (await this.issuePublicCredential(did, item, contextName, {
      key: encryptionKey,
    })) as VCResult;

    return result;
  }
  /**
   *  Method for for publishing an encrypted credential data
   * @param did
   * @param item
   * @param contextName
   * @param options
   * @returns {object}
   */

  async issuePublicCredential(
    did: string,
    item: any,
    contextName: string,
    options: any
  ): Promise<VCResult | unknown> {
    const defaults = {
      encrypt: true,
      key: EncryptionUtils.randomKey(32),
      permissions: {
        read: PermissionOptionsEnum.PUBLIC,
        write: PermissionOptionsEnum.OWNER,
      },
    };

    options = _.merge(defaults, options);
    options = _.merge(
      {
        schema: options.encrypt ? SCHEMAs.encrypted : SCHEMAs.default,
      },
      options
    );

    const schemas = await this.context.getClient().getSchema(options.schema);

    const json: any = await schemas.getSchemaJson();

    const dbName = json.database.name;

    const publicCredentials = await this.context.openDatabase(dbName, {
      permissions: options.permissions,
    });

    delete item._rev;

    let params = {};

    if (options.encrypt) {
      const key = new Uint8Array(options.key);
      const content = EncryptionUtils.symEncrypt(item.didJwtVc, key);
      item = {
        content: content,
        schema: options.schema,
      };
      params = {
        key: options.key,
      };
    }

    try {
      const result = (await publicCredentials.save(item, {})) as any;

      return {
        item: item,
        result: result,
        did: did,
        uri: Utils.buildVeridaUri(did, contextName, dbName, result.id, params),
      };
    } catch (err) {
      console.log(err);
    }
  }
}
