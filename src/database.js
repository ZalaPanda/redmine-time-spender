import Dexie from 'dexie';

const databaseName = 'redmine-cache';
const databaseSchema = {
    projects: '++, &id, updated_on',
    issues: '&id, updated_on',
    activities: '&id, active',
    entries: '&id, spent_on, updated_on', // order: updated_on <desc>
    tasks: '++id, closed_on'
};
const secretKey = '_data';

/**
 * Create Dexie database with encryption
 * @param {CryptoAPI} crypto 
 * @returns {Dexie.Database}
 */
export const createEntryptedDatabase = (crypto) => {
    const database = new Dexie(databaseName);
    database.version(1).stores(databaseSchema);
    return database.use({ // https://dexie.org/docs/Dexie/Dexie.use()
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
                            continue: { value: (key) => cursor.continue(key) }, // obsolete? undocumented?
                            continuePrimaryKey: { value: (key, primaryKey) => cursor.continuePrimaryKey(key, primaryKey) },
                            advance: { value: (count) => cursor.advance(count) },
                            start: { value: (onNext) => cursor.start(onNext) },
                            stop: { value: (value) => cursor.stop(value) },
                            next: { value: () => cursor.next() },
                            fail: { value: (error) => cursor.fail(error) }
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
                        const { values } = req;
                        return table.mutate({ ...req, values: values && values.map(encrypt) });
                    }
                };
            }
        })
    });
};