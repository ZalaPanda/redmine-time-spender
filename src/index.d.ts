export interface Lol {
    name: string;
    primKey: IndexSpec;
    indexes: IndexSpec[];
    mappedClass: Function;
    idxByName: { [name: string]: IndexSpec };
    readHook?: (x: any) => any
}
