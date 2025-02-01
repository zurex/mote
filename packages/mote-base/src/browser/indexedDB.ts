/* eslint-disable spaced-comment */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { toErrorMessage } from '@mote/base/common/errorMessage';
import { ErrorNoTelemetry, getErrorMessage } from '@mote/base/common/errors';

class MissingStoresError extends Error {
    constructor(readonly db: IDBDatabase) {
        super('Missing stores');
    }
}

export class DBClosedError extends Error {
    readonly code = 'DBClosed';
    constructor(dbName: string) {
        super(`IndexedDB database '${dbName}' is closed.`);
    }
}

export class IndexedDB {
    static async create(
        name: string,
        version: number | undefined,
        stores: string[],
        onupgradeneeded?: (tx: IDBTransaction) => void
    ): Promise<IndexedDB> {
        const database = await IndexedDB.openDatabase(
            name,
            version,
            stores,
            onupgradeneeded
        );
        return new IndexedDB(database, name);
    }

    private static async openDatabase(
        name: string,
        version: number | undefined,
        stores: string[],
        onupgradeneeded?: (tx: IDBTransaction) => void
    ): Promise<IDBDatabase> {
        try {
            return await IndexedDB.doOpenDatabase(
                name,
                version,
                stores,
                onupgradeneeded
            );
        } catch (err) {
            if (err instanceof MissingStoresError) {
                console.info(
                    `Attempting to recreate the IndexedDB once.`,
                    name
                );

                try {
                    // Try to delete the db
                    await IndexedDB.deleteDatabase(err.db);
                } catch (error) {
                    console.error(
                        `Error while deleting the IndexedDB`,
                        getErrorMessage(error)
                    );
                    throw error;
                }

                return await IndexedDB.doOpenDatabase(name, version, stores);
            }

            throw err;
        } finally {
        }
    }

    private static doOpenDatabase(
        name: string,
        version: number | undefined,
        stores: string[],
        onupgradeneeded?: (tx: IDBTransaction) => void
    ): Promise<IDBDatabase> {
        return new Promise((c, e) => {
            const request = indexedDB.open(name, version);
            request.onerror = () => e(request.error);
            request.onsuccess = () => {
                const db = request.result;
                for (const store of stores) {
                    if (!db.objectStoreNames.contains(store)) {
                        console.error(
                            `Error while opening IndexedDB. Could not find '${store}'' object store`
                        );
                        e(new MissingStoresError(db));
                        return;
                    }
                }
                c(db);
            };
            request.onupgradeneeded = () => {
                const db = request.result;
                for (const store of stores) {
                    if (!db.objectStoreNames.contains(store)) {
                        db.createObjectStore(store);
                    }
                }
                if (onupgradeneeded) {
                    onupgradeneeded(request.transaction!);
                }
            };
        });
    }

    private static deleteDatabase(database: IDBDatabase): Promise<void> {
        return new Promise((c, e) => {
            // Close any opened connections
            database.close();

            // Delete the db
            const deleteRequest = indexedDB.deleteDatabase(database.name);
            deleteRequest.onerror = (err) => e(deleteRequest.error);
            deleteRequest.onsuccess = () => c();
        });
    }

    private database: IDBDatabase | null = null;
    private readonly pendingTransactions: IDBTransaction[] = [];

    constructor(
        database: IDBDatabase,
        private readonly name: string
    ) {
        this.database = database;
    }

    hasPendingTransactions(): boolean {
        return this.pendingTransactions.length > 0;
    }

    close(): void {
        if (this.pendingTransactions.length) {
            this.pendingTransactions
                .splice(0, this.pendingTransactions.length)
                .forEach((transaction) => transaction.abort());
        }
        this.database?.close();
        this.database = null;
    }

    runInTransaction<T>(
        store: string,
        transactionMode: IDBTransactionMode,
        dbRequestFn: (store: IDBObjectStore) => IDBRequest<T>[]
    ): Promise<T[]>;

    runInTransaction<T>(
        store: string,
        transactionMode: IDBTransactionMode,
        dbRequestFn: (store: IDBObjectStore) => IDBRequest<T>
    ): Promise<T>;

    async runInTransaction<T>(
        store: string,
        transactionMode: IDBTransactionMode,
        dbRequestFn: (store: IDBObjectStore) => IDBRequest<T> | IDBRequest<T>[]
    ): Promise<T | T[]> {
        if (!this.database) {
            throw new DBClosedError(this.name);
        }
        const transaction = this.database.transaction(store, transactionMode);
        this.pendingTransactions.push(transaction);
        return new Promise<T | T[]>((c, e) => {
            transaction.oncomplete = () => {
                if (Array.isArray(request)) {
                    c(request.map((r) => r.result));
                } else {
                    c(request.result);
                }
            };
            transaction.onerror = () =>
                e(
                    transaction.error
                        ? ErrorNoTelemetry.fromError(transaction.error)
                        : new ErrorNoTelemetry('unknown error')
                );
            transaction.onabort = () =>
                e(
                    transaction.error
                        ? ErrorNoTelemetry.fromError(transaction.error)
                        : new ErrorNoTelemetry('unknown error')
                );
            const request = dbRequestFn(transaction.objectStore(store));
        }).finally(() =>
            this.pendingTransactions.splice(
                this.pendingTransactions.indexOf(transaction),
                1
            )
        );
    }

    async getKeyValues<V>(
        store: string,
        isValid: (value: unknown) => value is V,
        withIndex?: { index: string; value: IDBValidKey; limit?: number }
    ): Promise<Map<string, V>> {
        if (!this.database) {
            throw new DBClosedError(this.name);
        }
        const transaction = this.database.transaction(store, 'readonly');
        this.pendingTransactions.push(transaction);
        let count = 0;
        return new Promise<Map<string, V>>((resolve) => {
            const items = new Map<string, V>();

            const objectStore = transaction.objectStore(store);

            // Open a IndexedDB Cursor to iterate over key/values
            const cursor = withIndex
                ? objectStore.index(withIndex.index).openCursor(withIndex.value)
                : objectStore.openCursor();
            if (!cursor) {
                return resolve(items); // this means the `ItemTable` was empty
            }

            // Iterate over rows of `ItemTable` until the end
            cursor.onsuccess = () => {
                if (cursor.result) {
                    // Keep cursor key/value in our map
                    if (isValid(cursor.result.value)) {
                        items.set(
                            withIndex ? cursor.result.primaryKey.toString() : cursor.result.key.toString(),
                            cursor.result.value
                        );
                        count++;
                    }
                    if (withIndex?.limit && count >= withIndex.limit) {
                        resolve(items);
                        return;
                    }
                    // Advance cursor to next row
                    cursor.result.continue();
                } else {
                    resolve(items); // reached end of table
                }
            };

            // Error handlers
            const onError = (error: Error | null) => {
                console.error(
                    `IndexedDB getKeyValues(): ${toErrorMessage(error, true)}`
                );

                resolve(items);
            };
            cursor.onerror = () => onError(cursor.error);
            transaction.onerror = () => onError(transaction.error);
        }).finally(() =>
            this.pendingTransactions.splice(
                this.pendingTransactions.indexOf(transaction),
                1
            )
        );
    }
}
