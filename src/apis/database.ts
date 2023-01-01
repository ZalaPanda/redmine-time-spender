import Dexie from 'dexie';
import { CryptoAPI } from './crypto';

const database = new Dexie('redmine-cache');
database.version(1).stores({
    projects: '++, &id, updated_on',
    issues: '&id, updated_on',
    activities: '&id, active',
    entries: '&id, spent_on, updated_on',
    tasks: '++id, closed_on'
});
database.version(2).stores({
    projects: '++, &id, updated_on',
    issues: '&id, updated_on',
    activities: '&id, active',
    priorities: '&id, active',
    statuses: '&id',
    entries: '&id, spent_on, updated_on',
    tasks: '++id, closed_on'
}).upgrade(trans => {
    trans.table('projects').clear();
});

const secretKey = '_data';

/** Create Dexie database without encryption */
export const createUnentryptedDatabase = (): Dexie => database;

/** Create Dexie database with encryption */
export const createEntryptedDatabase = (crypto: CryptoAPI): Dexie => database.use({ // https://dexie.org/docs/Dexie/Dexie.use()
    stack: 'dbcore',
    name: 'crypto',
    create: (down) => ({
        ...down,
        table: name => {
            const table = down.table(name);
            const { schema: { primaryKey, indexes } } = table;
            const keyNames = [primaryKey?.keyPath, ...indexes?.map(index => index.keyPath)].filter(key => key);

            const encrypt = (value) => {
                if (!value) return value;
                const { [secretKey]: secretValue = undefined, ...props } = value;
                const [keys, rest] = Object.entries({ ...props, ...secretValue && crypto.decrypt(secretValue) }).reduce(([keys, rest], [key, value]) =>
                    keyNames.includes(key) ?
                        [{ ...keys, [key]: value }, rest] :
                        [keys, { ...rest, [key]: value }],
                    [{}, {}]);
                return { ...keys, [secretKey]: crypto.encrypt(rest) };
            };
            const decrypt = (value) => {
                if (!value) return value;
                const { [secretKey]: secretValue = undefined, ...props } = value;
                return { ...props, ...secretValue && crypto.decrypt(secretValue) };
            };

            return {
                ...table,
                openCursor: async req => {
                    const cursor = await table.openCursor(req);
                    return cursor && Object.create(cursor, { // https://dexie.org/docs/DBCore/DBCoreCursor
                        trans: { get: () => cursor.trans },
                        key: { get: () => cursor.key },
                        primaryKey: { get: () => cursor.primaryKey },
                        value: { get: () => decrypt(cursor.value) },
                        done: { get: () => cursor.done },
                        continue: { value: (key?: any) => cursor.continue(key) }, // obsolete? undocumented?
                        continuePrimaryKey: { value: (key: any, primaryKey: any) => cursor.continuePrimaryKey(key, primaryKey) },
                        advance: { value: (count: number) => cursor.advance(count) },
                        start: { value: (onNext: () => void) => cursor.start(onNext) },
                        stop: { value: (value?: any | Promise<any>) => cursor.stop(value) },
                        next: { value: () => cursor.next() },
                        fail: { value: (error: Error) => cursor.fail(error) }
                    });
                },
                get: async req => {
                    const value = await table.get(req);
                    return decrypt(value);
                },
                getMany: async req => {
                    const values = await table.getMany(req);
                    return values.map(decrypt);
                },
                query: async req => {
                    const { values } = req;
                    const res = await table.query(req);
                    const { result } = res;
                    return { ...res, result: values && result.map(decrypt) || result };
                },
                mutate: async req => {
                    if ('values' in req) {
                        const { values } = req;
                        return table.mutate({ ...req, values: values && values.map(encrypt) });
                    }
                    return table.mutate(req);
                }
            };
        }
    })
});