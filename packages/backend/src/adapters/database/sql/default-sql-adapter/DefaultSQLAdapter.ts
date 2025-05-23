export type  ResultType = 'SELECT' | 'RESULT'

export type SQLTypes = 'VARCHAR' | 'INT' | 'FLOAT' | 'DOUBLE' | 'BOOLEAN' | 'DATETIME' | 'TIMESTAMP' | 'DATE' | 'TIME' | 'YEAR' | 'DECIMAL' | 'CHAR' | 'TEXT' | 'BLOB' | 'ENUM' | 'SET' | 'TINYINT' | 'SMALLINT' | 'MEDIUMINT' | 'BIGINT' | 'BIT' | 'JSON' | 'XML' | 'UUID'

export type QueryResult = {
    type: 'SELECT'
    columns: string[]
    rows: any[]
} | {
    type: 'RESULT'
    result: any
}

export abstract class DefaultSQLAdapter {
    constructor() {}

    abstract connect(): Promise<void>;
    abstract close(): Promise<void>;

    abstract getTables();
    abstract execute(sql: string, params?: any[]|undefined): Promise<QueryResult>;
}