"use strict";
/**
 * REALM Protocol - Transaction Manager
 *
 * Gère les modifications atomiques avec support rollback.
 * Toute modification de fichier DOIT passer par une transaction.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManager = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const crypto_1 = require("crypto");
const ChangeLog_1 = require("./ChangeLog");
const FileLock_1 = require("./FileLock");
// ============================================================================
// Types
// ============================================================================
/** Génère un UUID v4 */
function generateId() {
    return crypto.randomUUID();
}
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
// ============================================================================
// Transaction Manager
// ============================================================================
class TransactionManager {
    static instance;
    /** Transactions actives */
    transactions = new Map();
    /** ChangeLog pour historique */
    changeLog;
    /** FileLock pour mutex */
    fileLock;
    /** TTL par défaut */
    defaultTTL;
    /** Cleanup interval */
    cleanupInterval = null;
    constructor(ttl = DEFAULT_TTL) {
        this.defaultTTL = ttl;
        this.changeLog = ChangeLog_1.ChangeLog.getInstance();
        this.fileLock = FileLock_1.FileLock.getInstance();
        // Démarrer le cleanup périodique
        this.startCleanup();
    }
    static getInstance() {
        if (!TransactionManager.instance) {
            TransactionManager.instance = new TransactionManager();
        }
        return TransactionManager.instance;
    }
    static resetInstance() {
        if (TransactionManager.instance?.cleanupInterval) {
            clearInterval(TransactionManager.instance.cleanupInterval);
        }
        TransactionManager.instance = new TransactionManager();
    }
    // ============================================================================
    // Transaction Lifecycle
    // ============================================================================
    /**
     * Démarre une nouvelle transaction
     */
    async begin(realmId, options = {}) {
        const filePath = realmId.sourceFile;
        // Acquérir le lock sur le fichier
        const lockAcquired = await this.fileLock.acquire(filePath);
        if (!lockAcquired) {
            throw new Error(`Cannot acquire lock on ${filePath}`);
        }
        try {
            // Créer le snapshot avant modification
            const beforeSnapshot = await this.createSnapshot(filePath);
            const transaction = {
                id: generateId(),
                realmId,
                operations: [],
                status: 'pending',
                beforeSnapshot,
                createdAt: Date.now(),
            };
            this.transactions.set(transaction.id, transaction);
            console.log(`[Transaction] Started: ${transaction.id} for ${filePath}`);
            return transaction;
        }
        catch (error) {
            // Relâcher le lock en cas d'erreur
            this.fileLock.release(filePath);
            throw error;
        }
    }
    /**
     * Ajoute une opération à une transaction
     */
    addOperation(transactionId, type, payload, before, after) {
        const transaction = this.getTransaction(transactionId);
        if (transaction.status !== 'pending') {
            throw new Error(`Transaction ${transactionId} is not pending (status: ${transaction.status})`);
        }
        const operation = {
            id: generateId(),
            type,
            target: transaction.realmId,
            before,
            after,
            payload,
        };
        transaction.operations.push(operation);
        console.log(`[Transaction] Added operation: ${type} to ${transactionId}`);
        return operation;
    }
    /**
     * Valide une transaction sans l'appliquer
     */
    async validate(transactionId) {
        const transaction = this.getTransaction(transactionId);
        const errors = [];
        const warnings = [];
        // Vérifier le statut
        if (transaction.status !== 'pending') {
            errors.push({
                code: 'INVALID_STATUS',
                message: `Transaction is ${transaction.status}, expected pending`,
            });
        }
        // Vérifier les opérations
        if (transaction.operations.length === 0) {
            warnings.push({
                code: 'NO_OPERATIONS',
                message: 'Transaction has no operations',
                suggestion: 'Add at least one operation before validating',
            });
        }
        // Vérifier que le fichier n'a pas changé
        const currentContent = await this.readFile(transaction.realmId.sourceFile);
        const currentHash = this.hashContent(currentContent);
        if (currentHash !== transaction.beforeSnapshot.hash) {
            errors.push({
                code: 'FILE_CHANGED',
                message: 'File has been modified since transaction started',
                location: transaction.realmId.sourceLocation,
            });
        }
        // Vérifier le TTL
        const age = Date.now() - transaction.createdAt;
        if (age > this.defaultTTL) {
            errors.push({
                code: 'TRANSACTION_EXPIRED',
                message: `Transaction expired (age: ${Math.round(age / 1000)}s)`,
            });
        }
        const valid = errors.length === 0;
        if (valid) {
            transaction.status = 'validated';
            transaction.validatedAt = Date.now();
        }
        return { valid, errors, warnings };
    }
    /**
     * Génère une prévisualisation des changements
     */
    async preview(transactionId) {
        const transaction = this.getTransaction(transactionId);
        // Pour l'instant, retourne une description textuelle
        const lines = [
            `Transaction: ${transaction.id}`,
            `File: ${transaction.realmId.sourceFile}`,
            `Operations (${transaction.operations.length}):`,
        ];
        for (const op of transaction.operations) {
            lines.push(`  - ${op.type}: ${JSON.stringify(op.payload).slice(0, 50)}...`);
        }
        return lines.join('\n');
    }
    /**
     * Commit une transaction (applique les changements)
     */
    async commit(transactionId, modifiedContent) {
        const transaction = this.getTransaction(transactionId);
        const filePath = transaction.realmId.sourceFile;
        // Vérifier le statut
        if (transaction.status !== 'validated') {
            throw new Error(`Transaction must be validated before commit (status: ${transaction.status})`);
        }
        try {
            // Créer le snapshot après modification
            const afterSnapshot = {
                filePath,
                content: modifiedContent,
                hash: this.hashContent(modifiedContent),
                timestamp: Date.now(),
            };
            transaction.afterSnapshot = afterSnapshot;
            // Écrire le fichier de manière atomique
            await this.atomicWrite(filePath, modifiedContent);
            // Mettre à jour le statut
            transaction.status = 'committed';
            transaction.committedAt = Date.now();
            // Enregistrer dans le changelog
            this.changeLog.add({
                id: generateId(),
                transactionId: transaction.id,
                timestamp: Date.now(),
                filePath,
                operations: transaction.operations,
                before: transaction.beforeSnapshot.content,
                after: modifiedContent,
                beforeHash: transaction.beforeSnapshot.hash,
                afterHash: afterSnapshot.hash,
            });
            console.log(`[Transaction] Committed: ${transactionId}`);
        }
        finally {
            // Toujours relâcher le lock
            this.fileLock.release(filePath);
        }
    }
    /**
     * Annule une transaction
     */
    async rollback(transactionId) {
        const transaction = this.getTransaction(transactionId);
        const filePath = transaction.realmId.sourceFile;
        try {
            // Si déjà commité, restaurer le fichier
            if (transaction.status === 'committed') {
                await this.atomicWrite(filePath, transaction.beforeSnapshot.content);
                // Marquer dans le changelog
                this.changeLog.markRolledBack(transactionId);
                console.log(`[Transaction] Rolled back committed transaction: ${transactionId}`);
            }
            transaction.status = 'rolled_back';
        }
        finally {
            this.fileLock.release(filePath);
        }
    }
    /**
     * Abandonne une transaction sans rollback
     */
    abort(transactionId) {
        const transaction = this.transactions.get(transactionId);
        if (!transaction)
            return;
        // Relâcher le lock si pending
        if (transaction.status === 'pending' || transaction.status === 'validated') {
            this.fileLock.release(transaction.realmId.sourceFile);
        }
        transaction.status = 'failed';
        transaction.error = 'Aborted';
        console.log(`[Transaction] Aborted: ${transactionId}`);
    }
    // ============================================================================
    // Query Methods
    // ============================================================================
    /**
     * Récupère une transaction
     */
    getTransaction(transactionId) {
        const tx = this.transactions.get(transactionId);
        if (!tx) {
            throw new Error(`Transaction not found: ${transactionId}`);
        }
        return tx;
    }
    /**
     * Vérifie si une transaction existe
     */
    hasTransaction(transactionId) {
        return this.transactions.has(transactionId);
    }
    /**
     * Récupère toutes les transactions actives
     */
    getActiveTransactions() {
        return Array.from(this.transactions.values()).filter(tx => tx.status === 'pending' || tx.status === 'validated');
    }
    /**
     * Récupère les transactions par fichier
     */
    getTransactionsByFile(filePath) {
        return Array.from(this.transactions.values()).filter(tx => tx.realmId.sourceFile === filePath);
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    async createSnapshot(filePath) {
        const content = await this.readFile(filePath);
        return {
            filePath,
            content,
            hash: this.hashContent(content),
            timestamp: Date.now(),
        };
    }
    async readFile(filePath) {
        try {
            return await fs.promises.readFile(filePath, 'utf-8');
        }
        catch (error) {
            throw new Error(`Cannot read file: ${filePath}`);
        }
    }
    hashContent(content) {
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    }
    async atomicWrite(filePath, content) {
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        try {
            // Écrire dans un fichier temporaire
            await fs.promises.writeFile(tempPath, content, 'utf-8');
            // Renommer (opération atomique sur la plupart des systèmes)
            await fs.promises.rename(tempPath, filePath);
        }
        catch (error) {
            // Nettoyer le fichier temporaire si nécessaire
            try {
                await fs.promises.unlink(tempPath);
            }
            catch {
                // Ignorer si le fichier n'existe pas
            }
            throw error;
        }
    }
    startCleanup() {
        // Nettoyer les transactions expirées toutes les minutes
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, tx] of this.transactions) {
                const age = now - tx.createdAt;
                // Supprimer les transactions terminées vieilles de plus d'une heure
                if ((tx.status === 'committed' || tx.status === 'rolled_back' || tx.status === 'failed') &&
                    age > 60 * 60 * 1000) {
                    this.transactions.delete(id);
                    continue;
                }
                // Abandonner les transactions pending expirées
                if ((tx.status === 'pending' || tx.status === 'validated') && age > this.defaultTTL) {
                    this.abort(id);
                }
            }
        }, 60 * 1000);
    }
    /**
     * Arrête le cleanup (pour les tests)
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}
exports.TransactionManager = TransactionManager;
//# sourceMappingURL=TransactionManager.js.map