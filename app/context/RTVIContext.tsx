'use client';

import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  Dispatch,
  SetStateAction,
  ReactNode,
} from 'react';
import { RTVIClient, LLMHelper, RTVIEvent } from '@pipecat-ai/client-js';
import { DailyTransport } from '@pipecat-ai/daily-transport';
import { defaultServices, defaultConfigV2 } from '@/config/rtvi.config';
import { createBotConfig } from '@/config/rtvi.config';
import { useRTVIClientEvent, RTVIClientProvider } from '@pipecat-ai/client-react';

type RTVIContextType = {
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  currentPage: number;
  setCurrentPage: Dispatch<SetStateAction<number>>;
  client: RTVIClient | null;
  botConfig: any;
  setBotConfig: Dispatch<SetStateAction<any>>;
  isConnected: boolean;
  setIsConnected: Dispatch<SetStateAction<boolean>>;
  llmHelper: LLMHelper | null;
  updateLLMContext: (messages: string | any[], interrupt?: boolean) => Promise<void>;
  selectedModel: string;
  setSelectedModel: Dispatch<SetStateAction<string>>;
  selectedPrompt: string;
  setSelectedPrompt: Dispatch<SetStateAction<string>>;
  selectedVoice: string;
  setSelectedVoice: Dispatch<SetStateAction<string>>;
  customPrompt: string;
  setCustomPrompt: Dispatch<SetStateAction<string>>;
  showCustomPrompt: boolean;
  setShowCustomPrompt: Dispatch<SetStateAction<boolean>>;
  isMinimalLoading: boolean;
  setIsMinimalLoading: Dispatch<SetStateAction<boolean>>;
};

export const RTVIContext = createContext<RTVIContextType>({} as RTVIContextType);

let client: RTVIClient | null = null;

interface RTVIProviderProps {
  children: ReactNode;
}

export const RTVIProvider: React.FC<RTVIProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [botConfig, setBotConfig] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [llmHelper, setLlmHelper] = useState<LLMHelper | null>(null);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [selectedPrompt, setSelectedPrompt] = useState('receptionist');
  const [selectedVoice, setSelectedVoice] = useState('b7d50908-b17c-442d-ad8d-810c63997ed9');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [isMinimalLoading, setIsMinimalLoading] = useState(false);

  const setIsLoadingRef = useRef<Dispatch<SetStateAction<boolean>>>(() => {});
  const setCurrentPageRef = useRef<Dispatch<SetStateAction<number>>>(() => {});

  const cleanupClient = useCallback(() => {
    if (client) {
      client.unregisterHelper('llm');
      setLlmHelper(null);
      setIsConnected(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsLoadingRef.current = setIsLoading;
    setCurrentPageRef.current = setCurrentPage;

    if (!client) {
      setIsMinimalLoading(true);
      const dailyTransport = new DailyTransport();
      client = new RTVIClient({
        transport: dailyTransport,
        params: {
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL || '/api',
          endpoints: {
            connect: '/bots-demo-web-call',
          },
          requestData: null,
          enableMic: true,
          enableCam: false,
        },
        timeout: 15 * 1000,
        callbacks: {
          onConnected: () => {
            console.log('[CALLBACK] User connected');
            setIsConnected(true);
            setIsMinimalLoading(false);
          },
          onDisconnected: () => {
            console.log('[CALLBACK] User disconnected');
            cleanupClient();
          },
          onTransportStateChanged: async (state) => {
            console.log('[CALLBACK] State change:', state);
            if (state === 'ready') {
              if (!llmHelper) {
                const helper = new LLMHelper({});
                client?.registerHelper('llm', helper);
                setLlmHelper(helper);
              }

              if (setIsLoadingRef.current) setIsLoadingRef.current(false);
              if (setCurrentPageRef.current) setCurrentPageRef.current(5);
              console.log('RTVICO: State change to ready');
            }
          },
          onBotConnected: () => {
            console.log('[CALLBACK] Bot connected');
          },
          onBotDisconnected: () => {
            console.log('[CALLBACK] Bot disconnected');
          },
          onBotReady: () => {
            console.log('[CALLBACK] Bot ready to chat!');
          },
        },
      });
    }
  }, [cleanupClient, llmHelper]);

  useRTVIClientEvent(
    RTVIEvent.Error,
    useCallback((message) => {
      const errorData = message.data;
      console.error('RTVIContext Error:', errorData);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.TransportStateChanged,
    useCallback((state) => {
      console.log('Transport State Changed:', state);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotConnected,
    useCallback(() => {
      console.log('Bot Connected');
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotDisconnected,
    useCallback(() => {
      console.log('Bot Disconnected');
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotTranscript,
    useCallback((text) => {
      console.log('RTVIContext - Bot Transcript (enum):', text);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotTtsText,
    useCallback((text) => {
      console.log('RTVIContext - Bot TTS Text:', text);
    }, [])
  );

  const updateLLMContext = useCallback(
    async (messages: string | any[], interrupt = false) => {
      if (!client) {
        console.error('Client not initialized');
        return;
      }

      try {
        console.log('Updating LLM Context:', messages);

        if (!llmHelper) {
          console.log('Initializing new LLM Helper');
          const helper = new LLMHelper({});
          client.registerHelper('llm', helper);
          setLlmHelper(helper);
        }

        await llmHelper?.setContext(
          {
            messages: Array.isArray(messages)
              ? messages
              : [
                  {
                    role: 'system',
                    content: messages,
                  },
                ],
          },
          interrupt
        );

        console.log('LLM Context updated successfully');
      } catch (error) {
        console.error('Error updating LLM context:', error);
      }
    },
    [llmHelper]
  );

  return (
    <RTVIContext.Provider
      value={{
        isLoading,
        setIsLoading,
        currentPage,
        setCurrentPage,
        client,
        botConfig,
        setBotConfig,
        isConnected,
        setIsConnected,
        llmHelper,
        updateLLMContext,
        selectedModel,
        setSelectedModel,
        selectedPrompt,
        setSelectedPrompt,
        selectedVoice,
        setSelectedVoice,
        customPrompt,
        setCustomPrompt,
        showCustomPrompt,
        setShowCustomPrompt,
        isMinimalLoading,
        setIsMinimalLoading,
      }}
    >
      {client ? (
        <RTVIClientProvider client={client}>{children}</RTVIClientProvider>
      ) : (
        children
      )}
    </RTVIContext.Provider>
  );
}; 