import * as vscode from 'vscode';

interface CopilotMetadata {
    reasoning?: string[];
    tasks?: {
        type: 'search' | 'read' | 'scan';
        description: string;
        files?: string[];
    }[];
    model?: string;
}

interface CopilotResponseData {
    content: string;
    metadata: CopilotMetadata;
}

/**
 * Chat Participant pour intercepter les réponses de Copilot
 * et capturer les métadonnées (raisonnement, tâches, fichiers lus)
 */
export class CopilotChatParticipant {
    private static instance: CopilotChatParticipant;
    private participant: vscode.ChatParticipant | undefined;
    private latestResponse: CopilotResponseData | null = null;
    private responseEmitter = new vscode.EventEmitter<CopilotResponseData>();
    public readonly onResponse = this.responseEmitter.event;

    private constructor() {}

    public static getInstance(): CopilotChatParticipant {
        if (!CopilotChatParticipant.instance) {
            CopilotChatParticipant.instance = new CopilotChatParticipant();
        }
        return CopilotChatParticipant.instance;
    }

    /**
     * Active le chat participant pour intercepter Copilot
     */
    public activate(context: vscode.ExtensionContext) {
        try {
            // Créer un chat participant qui intercepte les requêtes
            this.participant = vscode.chat.createChatParticipant(
                'copilot-interceptor',
                this.handleChatRequest.bind(this)
            );

            this.participant.iconPath = vscode.Uri.file(
                context.asAbsolutePath('resources/icon.svg')
            );

            context.subscriptions.push(this.participant);
            console.log('[CopilotParticipant] Chat participant activated');
        } catch (error) {
            console.error('[CopilotParticipant] Failed to activate:', error);
        }
    }

    /**
     * Gère les requêtes de chat et capture les métadonnées
     */
    private async handleChatRequest(
        request: vscode.ChatRequest,
        context: vscode.ChatContext,
        stream: vscode.ChatResponseStream,
        token: vscode.CancellationToken
    ): Promise<void> {
        const metadata: CopilotMetadata = {
            reasoning: [],
            tasks: [],
            model: request.model?.id
        };

        let fullContent = '';

        try {
            // Utiliser le modèle sélectionné dans la requête
            const model = request.model;
            
            if (!model) {
                stream.markdown('No model available');
                return;
            }

            // Préparer les messages pour le modèle
            const messages: vscode.LanguageModelChatMessage[] = [
                vscode.LanguageModelChatMessage.User(request.prompt)
            ];

            // Ajouter l'historique si disponible
            if (context.history && context.history.length > 0) {
                for (const historyItem of context.history) {
                    if (historyItem instanceof vscode.ChatRequestTurn) {
                        messages.push(
                            vscode.LanguageModelChatMessage.User(historyItem.prompt)
                        );
                    } else if (historyItem instanceof vscode.ChatResponseTurn) {
                        // Extraire le contenu de la réponse
                        const responseText = historyItem.response
                            .map((part) => {
                                if (part instanceof vscode.ChatResponseMarkdownPart) {
                                    return part.value.value;
                                }
                                return '';
                            })
                            .join('\n');
                        
                        messages.push(
                            vscode.LanguageModelChatMessage.Assistant(responseText)
                        );
                    }
                }
            }

            // Envoyer la requête au modèle
            const chatResponse = await model.sendRequest(
                messages,
                {},
                token
            );

            // Streamer la réponse et capturer les métadonnées
            let currentThinking = '';
            let isThinking = false;

            for await (const fragment of chatResponse.text) {
                if (token.isCancellationRequested) {
                    break;
                }

                fullContent += fragment;

                // Détecter le raisonnement (thinking)
                // Les modèles comme o1 commencent souvent par des balises de raisonnement
                if (fragment.includes('<thinking>') || fragment.includes('Let me think')) {
                    isThinking = true;
                    currentThinking = fragment;
                    continue;
                }

                if (isThinking) {
                    currentThinking += fragment;
                    if (fragment.includes('</thinking>') || fragment.includes('\n\n')) {
                        metadata.reasoning?.push(currentThinking.trim());
                        isThinking = false;
                        currentThinking = '';
                        continue;
                    }
                    continue;
                }

                // Détecter les tâches (recherche, lecture de fichiers)
                if (fragment.includes('Reading') || fragment.includes('Scanning') || fragment.includes('Searching')) {
                    const taskMatch = fragment.match(/(Reading|Scanning|Searching)\s+(.+)/);
                    if (taskMatch) {
                        metadata.tasks?.push({
                            type: taskMatch[1].toLowerCase() as 'read' | 'scan' | 'search',
                            description: taskMatch[2].trim()
                        });
                    }
                }

                // Streamer le contenu visible
                stream.markdown(fragment);
            }

            // Sauvegarder la réponse complète avec métadonnées
            this.latestResponse = {
                content: fullContent,
                metadata
            };

            // Émettre l'événement
            this.responseEmitter.fire(this.latestResponse);

            console.log('[CopilotParticipant] Response captured:', {
                contentLength: fullContent.length,
                reasoningSteps: metadata.reasoning?.length || 0,
                tasks: metadata.tasks?.length || 0
            });

        } catch (error) {
            console.error('[CopilotParticipant] Error handling request:', error);
            stream.markdown(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Récupère la dernière réponse capturée
     */
    public getLatestResponse(): CopilotResponseData | null {
        return this.latestResponse;
    }

    /**
     * Envoie une requête directement au modèle et capture la réponse
     */
    public async sendRequest(
        prompt: string,
        modelId: string,
        history?: vscode.LanguageModelChatMessage[]
    ): Promise<CopilotResponseData> {
        const metadata: CopilotMetadata = {
            reasoning: [],
            tasks: [],
            model: modelId
        };

        let fullContent = '';

        try {
            // Sélectionner le modèle
            const models = await vscode.lm.selectChatModels({ id: modelId });
            
            if (models.length === 0) {
                throw new Error(`Model ${modelId} not found`);
            }

            const model = models[0];

            // Préparer les messages
            const messages: vscode.LanguageModelChatMessage[] = history || [];
            messages.push(vscode.LanguageModelChatMessage.User(prompt));

            // Envoyer la requête
            const chatResponse = await model.sendRequest(
                messages,
                {},
                new vscode.CancellationTokenSource().token
            );

            // Capturer la réponse
            let currentThinking = '';
            let isThinking = false;

            for await (const fragment of chatResponse.text) {
                fullContent += fragment;

                // Détecter le raisonnement
                if (fragment.includes('<thinking>') || fragment.includes('Let me think')) {
                    isThinking = true;
                    currentThinking = fragment;
                    continue;
                }

                if (isThinking) {
                    currentThinking += fragment;
                    if (fragment.includes('</thinking>') || fragment.includes('\n\n')) {
                        metadata.reasoning?.push(currentThinking.trim());
                        isThinking = false;
                        currentThinking = '';
                        continue;
                    }
                    continue;
                }

                // Détecter les tâches
                if (fragment.includes('Reading') || fragment.includes('Scanning') || fragment.includes('Searching')) {
                    const taskMatch = fragment.match(/(Reading|Scanning|Searching)\s+(.+)/);
                    if (taskMatch) {
                        metadata.tasks?.push({
                            type: taskMatch[1].toLowerCase() as 'read' | 'scan' | 'search',
                            description: taskMatch[2].trim()
                        });
                    }
                }
            }

            const response = {
                content: fullContent,
                metadata
            };

            this.latestResponse = response;
            this.responseEmitter.fire(response);

            return response;

        } catch (error) {
            console.error('[CopilotParticipant] Error sending request:', error);
            throw error;
        }
    }
}
