'use client';

import React, {
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
  MouseEvent,
} from 'react';
import { RTVIContext } from '@/app/context/RTVIContext';
import { RTVIClientAudio, useRTVIClientEvent } from '@pipecat-ai/client-react';
import { RTVIEvent, LLMHelper } from '@pipecat-ai/client-js';
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconArrowRight,
  IconCornerDownRight,
  IconLogout,
  IconAlertCircle,
  IconCircleCheck,
} from '@tabler/icons-react';
import { PROMPTS, DEMO_FUNCTIONS } from '@/config/prompts';
import { voiceGroupings, voicesByLanguage } from '@/app/voiceOptions';

type VoiceOption = {
  label: string;
  value: string;
  labels: string[];
};

const DEFAULT_VOICE_ID = '5345cf08-6f37-424d-a5d9-8ae1101b9377';

const LOADING_SUGGESTIONS: string[] = [
  'you are talking to a voice AI agent',
  'you can interrupt the agent anytime',
  'this demo is built on Pipecat hosted on Daily',
  'you can interrupt the agent anytime',
  'the AI can switch between different roles',
  'you can interrupt the agent anytime',
  'natural response times as low as 500ms',
  'you can interrupt the agent anytime',
  'the AI can switch between different roles',
  'powered by state-of-the-art LLMs',
];

// Voice color mixing
const voiceColors = {
  female: ['bg-purple-100', 'bg-pink-100', 'bg-red-100', 'bg-fuchsia-100'],
  male: ['bg-blue-100', 'bg-orange-100', 'bg-yellow-100', 'bg-green-100'],
};

const getVoiceColor = (voiceId: string): string => {
  if (voiceId === DEFAULT_VOICE_ID) {
    return 'bg-green-100';
  }
  const allVoices: VoiceOption[] = Object.values(voicesByLanguage)
    .flat()
    .map((voice) => voice as VoiceOption);
  const voice = allVoices.find((v) => v.value === voiceId);
  if (!voice) return 'bg-blue-100';
  const gender = voice.labels[0];
  if (!voiceColors[gender]) return 'bg-blue-100';
  const lastChar = voiceId.slice(-1);
  const colorIndex = parseInt(lastChar, 16) % voiceColors[gender].length;
  return voiceColors[gender][colorIndex];
};

type Line = {
  type: 'system' | 'ai';
  text: string;
  words?: string[];
  icon?: string;
  promptType?: string;
  groupId?: number;
};

export default function WebCallInterfaceMinimal() {
  const { client, isConnected, setIsConnected, llmHelper } = useContext(RTVIContext);

  const [currentPromptType, setCurrentPromptType] = useState('demoBot');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [systemMessageGroupId, setSystemMessageGroupId] = useState(0);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isTransitioningText, setIsTransitioningText] = useState(false);
  const volRef = useRef<(HTMLDivElement | null)[]>([]);
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const currentAILineRef = useRef<number | null>(null);
  const currentSentenceBufferRef = useRef('');
  const [connectingDots, setConnectingDots] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [listeningDots, setListeningDots] = useState('');
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  const [connectionState, setConnectionState] = useState<'idle' | 'requesting_permissions' | 'connecting' | 'connected' | 'error'>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isTransitioningConnectionMessage, setIsTransitioningConnectionMessage] = useState(false);
  const [currentVoiceId, setCurrentVoiceId] = useState(DEFAULT_VOICE_ID);

  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop;
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          setTimeout(() => {
            if (
              terminalRef.current &&
              terminalRef.current.scrollTop + terminalRef.current.clientHeight <
                terminalRef.current.scrollHeight
            ) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
          }, 50);
        }
      }, 0);
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;
    const observer = new MutationObserver(scrollToBottom);
    observer.observe(terminalRef.current, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  const isLineActive = useCallback(
    (lineIndex: number) => {
      return (
        currentAILineRef.current === lineIndex ||
        (lineIndex === lines.length - 1 && lines[lineIndex]?.type === 'ai')
      );
    },
    [lines]
  );

  const handleSystemMessage = useCallback(
    (message: string, isFirstInGroup = false) => {
      if (isFirstInGroup) {
        setSystemMessageGroupId((prev) => prev + 1);
      }
      setLines((prev) => [
        ...prev,
        {
          type: 'system',
          text: message,
          groupId: systemMessageGroupId,
        },
      ]);
      if (terminalRef.current) {
        setTimeout(() => {
          terminalRef.current!.scrollTop = terminalRef.current!.scrollHeight;
        }, 50);
      }
    },
    [systemMessageGroupId]
  );

  useRTVIClientEvent(
    RTVIEvent.BotStartedSpeaking,
    useCallback(() => {
      setIsTalking(true);
      setIsListening(false);
      setHasSpokenOnce(true);
      currentSentenceBufferRef.current = '';
      setLines((prev) => {
        const newLines = [...prev];
        const newIndex = newLines.length;
        currentAILineRef.current = newIndex;
        return [
          ...newLines,
          {
            type: 'ai',
            text: '',
            words: [],
            icon: 'left',
            promptType: currentPromptType,
          },
        ];
      });
      scrollToBottom();
    }, [scrollToBottom, currentPromptType])
  );

  useRTVIClientEvent(
    'botTtsText',
    useCallback(
      (data: { text: string } | string) => {
        const text = typeof data === 'string' ? data : data.text;
        if (!text || currentAILineRef.current === null) return;
        const newBuffer =
          currentSentenceBufferRef.current +
          (currentSentenceBufferRef.current ? ' ' : '') +
          text;
        currentSentenceBufferRef.current = newBuffer;
        const words = newBuffer.trim().split(' ');
        setActiveWordIndex(words.length - 1);

        setLines((prev) => {
          const newLines = [...prev];
          if (newLines[currentAILineRef.current!]) {
            newLines[currentAILineRef.current!] = {
              ...newLines[currentAILineRef.current!],
              text: newBuffer.trim(),
              words,
            };
          }
          return newLines;
        });
        requestAnimationFrame(scrollToBottom);

        const shouldBreakLine = (buffer: string) => {
          if (buffer.match(/\d+\.\s*$/) || buffer.match(/[a-z]\.\s*$/) || buffer.endsWith('• ')) {
            return true;
          }
          if (buffer.endsWith('? ')) return true;
          if (buffer.endsWith('... ') || buffer.endsWith('   ')) return true;
          if (buffer.endsWith('! ')) return true;
          return false;
        };

        if (shouldBreakLine(newBuffer)) {
          setTimeout(() => {
            if (isTalking) {
              setLines((prev) => {
                const newLines = [...prev];
                const newIndex = newLines.length;
                currentAILineRef.current = newIndex;
                return [
                  ...newLines,
                  {
                    type: 'ai',
                    text: '',
                    words: [],
                    icon: 'left',
                    promptType: currentPromptType,
                  },
                ];
              });
              setActiveWordIndex(-1);
              scrollToBottom();
              currentSentenceBufferRef.current = '';
            }
          }, 50);
        }
      },
      [isTalking, scrollToBottom, currentPromptType]
    )
  );

  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    useCallback(() => {
      setIsTalking(false);
      setIsListening(true);
      setActiveWordIndex(-1);
      if (currentSentenceBufferRef.current.trim() && currentAILineRef.current !== null) {
        setLines((prev) => {
          const newLines = [...prev];
          if (newLines[currentAILineRef.current!]) {
            if (!newLines[currentAILineRef.current!].text) {
              newLines[currentAILineRef.current!] = {
                ...newLines[currentAILineRef.current!],
                text: currentSentenceBufferRef.current.trim(),
              };
              return newLines;
            }
          }
          return prev;
        });
      }
      currentSentenceBufferRef.current = '';
    }, [])
  );

  useEffect(() => {
    if (!isConnected || !isTalking) {
      volRef.current.forEach((bar) => {
        if (bar) bar.style.opacity = '0.1';
      });
      return;
    }

    const interval = setInterval(() => {
      const numBars = 50;
      const time = Date.now();
      const f1 = Math.sin(time / 200) * 0.15;
      const f2 = Math.sin(time / 50) * 0.1;
      const f3 = Math.sin(time / 120) * 0.05;
      const baseVolume = 0.35 + f1 + f2 + f3;
      const jitter = Math.random() * 0.1;
      const finalVolume = Math.max(0.2, Math.min(0.8, baseVolume + jitter));
      const activeBars = Math.round(finalVolume * numBars);

      volRef.current.forEach((bar, index) => {
        if (bar) {
          const barPosition = index / numBars;
          const barVolume = Math.max(0.1, finalVolume * (1 - Math.abs(barPosition - 0.5)));
          bar.style.opacity = index < activeBars ? barVolume.toFixed(2) : '0.1';
        }
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isConnected, isTalking]);

  useEffect(() => {
    if (!isInitializing && !isListening) {
      setConnectingDots('');
      setListeningDots('');
      return;
    }
    const interval = setInterval(() => {
      if (isInitializing) {
        setConnectingDots((prev) => (prev === '...' ? '' : prev + '.'));
      }
      if (isListening) {
        setListeningDots((prev) => (prev === '...' ? '' : prev + '.'));
      }
    }, 300);
    return () => clearInterval(interval);
  }, [isInitializing, isListening]);

  useEffect(() => {
    if (!isInitializing || connectionState === 'requesting_permissions') {
      setConnectionMessage('');
      return;
    }
    const connectionMessages = ['initializing services', 'connecting to the closest server'];
    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < connectionMessages.length) {
        setIsTransitioningConnectionMessage(true);
        setTimeout(() => {
          setConnectionMessage(connectionMessages[messageIndex]);
          setIsTransitioningConnectionMessage(false);
          messageIndex++;
        }, 200);
      }
    }, 1500);

    return () => clearInterval(messageInterval);
  }, [isInitializing, connectionState]);

  const handleStartCall = async () => {
    if (!client || isInitializing) return;
    setIsInitializing(true);
    setError('');
    setIsExpanded(true);
    setConnectionState('requesting_permissions');

    try {
      await client.initDevices();
      setIsTransitioningConnectionMessage(true);
      await new Promise((resolve) => setTimeout(resolve, 200));
      setConnectionState('connecting');
      setIsTransitioningConnectionMessage(false);

      const basicConfig = {
        name: 'Demo Bot',
        config: [
          {
            service: 'vad',
            options: [{ name: 'params', value: { stop_secs: 0.3 } }],
          },
          {
            service: 'tts',
            options: [
              { name: 'voice', value: DEFAULT_VOICE_ID },
              { name: 'model', value: 'sonic-english' },
              { name: 'language', value: 'en' },
            ],
          },
          {
            service: 'llm',
            options: [
              { name: 'model', value: 'gpt-4o' },
              {
                name: 'initial_messages',
                value: [{ role: 'system', content: PROMPTS.demoBot }],
              },
              { name: 'tools', value: DEMO_FUNCTIONS },
              { name: 'run_on_config', value: true },
            ],
          },
          {
            service: 'stt',
            options: [
              { name: 'model', value: 'nova-2-conversationalai' },
              { name: 'language', value: 'en-US' },
            ],
          },
        ],
        services: {
          llm: 'openai',
          tts: 'cartesia',
          stt: 'deepgram',
        },
      };

      console.log('Setting up bot with config:', {
        tools: DEMO_FUNCTIONS,
        prompt: `${PROMPTS.demoBot.substring(0, 200)}...`,
      });

      client.params.requestData = basicConfig;

      try {
        await client.connect();
        await new Promise<void>((resolve, reject) => {
          const checkState = () => {
            if (client!.transport.state === 'ready') {
              resolve();
            } else if (client!.transport.state === 'error') {
              reject(new Error('Transport error'));
            } else {
              setTimeout(checkState, 100);
            }
          };
          checkState();
        });

        setIsConnected(true);
        setIsInitializing(false);
        setConnectionState('connected');

        setLines([
          {
            type: 'system',
            text: 'Connected! You can now start talking to the AI assistant.',
            groupId: systemMessageGroupId,
          },
        ]);
      } catch (err) {
        throw err;
      }
    } catch (error: unknown) {
      console.error('Failed to start call:', error);
      setError('Failed to establish connection. Please try again.');
      setLines([]);
      setConnectionState('error');
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    if (!llmHelper || !client) {
      console.log('No llmHelper or client available:', { llmHelper, client });
      return;
    }

    console.log('Setting up function call handler');
    const handler = async (fn: { functionName: string; arguments: any }) => {
      console.log('Function call received:', fn);
      if (fn.functionName === 'log_uncertain_question') {
        const { question } = fn.arguments;
        console.log('Logging uncertain question:', question);
        try {
          console.log('Making request to /api/uncertain-questions');
          const response = await fetch('/api/uncertain-questions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              question,
              conversationId: '',
              promptType: currentPromptType,
            }),
          });
          const data = await response.json();
          console.log('Response from uncertain-questions API:', data);
          if (!data.success) throw new Error(data.error);
          return {
            status: 'success',
            message: 'Question logged successfully',
          };
        } catch (error) {
          console.error('Failed to log uncertain question:', error);
          return {
            status: 'error',
            message: 'Failed to log question',
            error: (error as Error).message,
          };
        }
      }

      if (fn.functionName === 'select_demo_experience') {
        const { experience_type, reason } = fn.arguments;
        console.log('Handling select_demo_experience:', {
          experience_type,
          reason,
        });
        const promptKey = {
          sales_representative: 'salesRepresentative',
          receptionist: 'receptionist',
          survey_caller: 'surveyCaller',
          support_agent: 'supportAgent',
        }[experience_type] || 'demoBot';

        const colorKey = {
          salesRepresentative: 'sales_representative',
          receptionist: 'receptionist',
          surveyCaller: 'survey_caller',
          supportAgent: 'support_agent',
        }[promptKey] || 'demoBot';

        setCurrentPromptType(promptKey);

        if (!promptKey || !PROMPTS[promptKey]) {
          console.error('Invalid experience type:', experience_type);
          return { error: 'Invalid experience type' };
        }

        setIsTransitioning(true);
        handleSystemMessage(
          `Function called: Switching to ${experience_type.replace(/_/g, ' ')} demo...`,
          true
        );

        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          handleSystemMessage('Updating AI context and prompt...');

          const waitForBotToStop = new Promise<void>((resolve) => {
            const handleBotStopped = () => {
              console.log('Bot stopped speaking, updating config...');
              resolve();
              client?.off(RTVIEvent.BotStoppedSpeaking, handleBotStopped);
            };
            if (!isTalking) {
              resolve();
            } else {
              client?.on(RTVIEvent.BotStoppedSpeaking, handleBotStopped);
            }
          });

          await waitForBotToStop;
          setLines((prev) => prev.filter((line) => line.type === 'system'));
          const newVoiceId = await handleConfigUpdate(promptKey);

          console.log('Updating config with new prompt and voice:', promptKey, newVoiceId);
          await client?.updateConfig([
            {
              service: 'llm',
              options: [
                {
                  name: 'initial_messages',
                  value: [
                    {
                      role: 'system',
                      content:
                        promptKey === 'demoBot'
                          ? PROMPTS[promptKey]
                          : PROMPTS[promptKey].replace(
                              '{Your name}',
                              getVoiceName(newVoiceId)
                            ),
                    },
                  ],
                },
              ],
            },
            {
              service: 'tts',
              options: [{ name: 'voice', value: newVoiceId }],
            },
          ]);

          await new Promise((resolve) => setTimeout(resolve, 800));
          handleSystemMessage(
            `Context updated successfully! Starting ${experience_type.replace(/_/g, ' ')} demo...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          handleSystemMessage(
            `Welcome to the ${experience_type.replace(/_/g, ' ')} demo!`
          );
          setIsTransitioning(false);

          return {
            status: 'success',
            message: `Switched to ${experience_type.replace(/_/g, ' ')} demo`,
            selected_experience: experience_type,
          };
        } catch (error) {
          console.error('Failed to update config:', error);
          handleSystemMessage('Error: Failed to update configuration');
          setIsTransitioning(false);
          return {
            status: 'error',
            message: 'Failed to update configuration',
            error: (error as Error).message,
          };
        }
      }
    };

    llmHelper.handleFunctionCall(handler);
    console.log('Function call handler registered successfully');

    return () => {
      console.log('Cleaning up function call handler');
      llmHelper.handleFunctionCall(null);
    };
  }, [llmHelper, client, isTalking, handleSystemMessage, systemMessageGroupId, currentPromptType]);

  const handleDisconnect = async () => {
    if (!client) return;
    try {
      await client.disconnect();
      setIsConnected(false);
      setIsInitializing(false);
      setIsExpanded(false);
      setLines([]);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const toggleMic = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!client || client.transport?.state !== 'ready') return;
    try {
      await client.enableMic(!isMicEnabled);
      setIsMicEnabled(!isMicEnabled);
    } catch (error) {
      console.error('Error toggling mic:', error);
    }
  };

  useEffect(() => {
    if (!client || !isConnected) return;
    const checkMicState = () => {
      try {
        const tracks = client.tracks();
        const isEnabled = tracks?.local?.audio?.enabled || false;
        setIsMicEnabled(isEnabled);
      } catch (error) {
        console.error('Error checking mic state:', error);
        setIsMicEnabled(false);
      }
    };
    checkMicState();

    const handleTrackEnabled = () => checkMicState();
    const handleTrackDisabled = () => checkMicState();
    if (client.transport) {
      client.transport.on('track:enabled', handleTrackEnabled);
      client.transport.on('track:disabled', handleTrackDisabled);
    }

    return () => {
      if (client.transport) {
        client.transport.off('track:enabled', handleTrackEnabled);
        client.transport.off('track:disabled', handleTrackDisabled);
      }
    };
  }, [client, isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setIsTransitioningText(true);
      setTimeout(() => {
        setCurrentSuggestionIndex((prev) => (prev + 1) % LOADING_SUGGESTIONS.length);
        setIsTransitioningText(false);
      }, 500);
    }, 6000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const handleConfigUpdate = async (promptKey: string): Promise<string> => {
    const recommendedVoices: string[] =
      voiceGroupings[promptKey]?.recommended || voiceGroupings.demoBot.recommended;
    const availableVoices = recommendedVoices.filter((voiceId) => voiceId !== currentVoiceId);
    const voicesToSelectFrom = availableVoices.length > 0 ? availableVoices : recommendedVoices;
    const randomVoice = voicesToSelectFrom[Math.floor(Math.random() * voicesToSelectFrom.length)];
    setCurrentVoiceId(randomVoice);
    return randomVoice;
  };

  const getVoiceName = (voiceId: string): string => {
    const voice = Object.values(voicesByLanguage)
      .flat()
      .find((v) => v.value === voiceId);
    return voice ? voice.label : '';
  };

  return (
    <div className='w-full border-y bg-white border-black z-10'>
      {error && (
        <div className='bg-red-50 border-l-4 border-red-400 p-4'>
          <p className='text-sm text-red-700'>{error}</p>
        </div>
      )}

      <div
        className={`transition-all duration-500 ease-in-out ${
          isExpanded ? 'h-[140px] opacity-100' : 'h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className='h-full bg-white font-mono text-sm'>
          <div ref={terminalRef} className='h-[110px] overflow-y-auto pt-2'>
            <div className='w-full px-4 pl-2 space-y-2 flex flex-col'>
              {lines.map((line, i) => {
                if (line.type === 'system') {
                  const isSuccessMessage = line.text.toLowerCase().includes('success');
                  const isFirstMessage = i === 0;
                  return (
                    <div key={i} className={`flex items-center ${isFirstMessage ? 'mt-2' : ''}`}>
                      {isSuccessMessage ? (
                        <IconCircleCheck className='text-green-500 mr-2' size={20} />
                      ) : (
                        <IconAlertCircle className='text-yellow-500 mr-2' size={20} />
                      )}
                      <span className='font-mono text-xs text-gray-700'>{line.text}</span>
                    </div>
                  );
                }
                const isActive = isLineActive(i);
                return (
                  <div key={i} className='flex items-start'>
                    <span
                      className={`relative flex-1 text-black font-sans transition-all duration-700 ease-in-out transform ${
                        isActive
                          ? 'mt-2 text-[22px] sm:text-[30px] leading-[1.2] translate-y-0 opacity-100'
                          : 'text-[18px] sm:text-[20px] leading-[1.2] opacity-60 translate-y-1'
                      }`}
                    >
                      <span className='font-normal'>
                        {line.words
                          ? line.words.map((word, wordIndex) => {
                              const isActiveWord =
                                isActive && activeWordIndex >= 0 && wordIndex === activeWordIndex;
                              const isWordVisible =
                                !isActive ||
                                activeWordIndex < 0 ||
                                wordIndex <= activeWordIndex;
                              return (
                                <React.Fragment key={wordIndex}>
                                  <span
                                    className={`${
                                      isActiveWord
                                        ? `${getVoiceColor(currentVoiceId)} opacity-100 rounded-md pl-1 pr-1 transform scale-105`
                                        : isWordVisible
                                        ? 'opacity-100'
                                        : 'opacity-0'
                                    } transition-all duration-300 ease-in-out transform-gpu will-change-transform`}
                                  >
                                    {word}
                                  </span>
                                  {wordIndex < line.words!.length - 1 && (
                                    <span
                                      className={`${
                                        isWordVisible ? 'opacity-100' : 'opacity-0'
                                      } transition-all duration-300 ease-in-out transform-gpu will-change-transform`}
                                    >
                                      {' '}
                                    </span>
                                  )}
                                </React.Fragment>
                              );
                            })
                          : line.text}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isConnected && (
        <div className='flex items-center px-2 pb-2 text-sm'>
          <div className='flex-1 flex gap-0.5 h-1.5 items-stretch'>
            {Array.from({ length: 50 }).map((_, index) => (
              <div
                key={index}
                ref={(el) => (volRef.current[index] = el)}
                className='flex-1 bg-black transition-all duration-150 ease-in-out'
                style={{ opacity: 0.1 }}
              />
            ))}
          </div>
        </div>
      )}

      <div
        className={`group relative flex items-center justify-between px-4 py-4 ${
          isConnected || isInitializing ? 'border-t' : ''
        } border-black text-sm font-mono cursor-pointer transition-all duration-500 ease-in-out ${
          isConnected ? 'bg-[#161618]' : 'hover:bg-gray-50'
        }`}
        onClick={() => {
          if (!isConnected && !isInitializing) {
            handleStartCall();
          }
        }}
      >
        <div className='flex items-center gap-3 flex-1'>
          <div
            className={`flex items-center select-none transition-all duration-500 ease-in-out transform min-h-[28px] ${
              isConnected ? 'text-white text-base' : 'text-black text-lg'
            } pr-24 sm:pr-32`}
          >
            <span
              className={`transition-all duration-500 ease-in-out ${
                isTransitioningText || isTransitioningConnectionMessage
                  ? 'opacity-0'
                  : 'opacity-100'
              }`}
            >
              {isConnected
                ? isListening && hasSpokenOnce
                  ? `Listening${listeningDots}`
                  : LOADING_SUGGESTIONS[currentSuggestionIndex]
                : isInitializing
                ? connectionState === 'requesting_permissions'
                  ? `requesting microphone permissions${connectingDots}`
                  : `${connectionMessage || 'connecting'}${connectingDots}`
                : 'Try a live demo. Talk to a voice AI agent'}
            </span>
          </div>
        </div>

        <div
          className={`absolute right-0 top-0 bottom-0 flex items-center gap-2 sm:gap-4 transition-all duration-500 ease-in-out ${
            isConnected ? 'bg-[#161618]' : ''
          } px-3 sm:px-6`}
        >
          <div className='relative'>
            <IconMicrophone
              size={24}
              className={`transition-all text-black duration-300 ease-in-out ${
                isInitializing ? 'animate-pulse' : ''
              } ${!isConnected ? 'opacity-100' : 'opacity-0'}`}
            />
            {isConnected && (
              <button
                onClick={toggleMic}
                className='absolute inset-0 text-white transition-opacity duration-300 ease-in-out hover:opacity-80'
              >
                {isMicEnabled ? (
                  <IconMicrophone size={24} className='transition-all duration-300 ease-in-out' />
                ) : (
                  <IconMicrophoneOff size={24} className='transition-all duration-300 ease-in-out' />
                )}
              </button>
            )}
          </div>

          <div
            className={`h-6 w-px transition-all duration-500 ease-in-out ${
              isConnected ? 'bg-white/20' : 'bg-black/20'
            }`}
          />

          <div className='relative w-7 h-7'>
            <IconArrowRight
              className={`absolute text-black inset-0 w-7 h-7 transition-all duration-300 ease-in-out group-hover:translate-x-1 ${
                isConnected || isInitializing ? 'opacity-0' : 'opacity-100'
              }`}
              stroke={2}
            />
            {isInitializing && !isConnected && (
              <div className='absolute inset-0 flex items-center justify-center'>
                <div className='animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-black dark:border-t-white dark:border-gray-600' />
              </div>
            )}
            {isConnected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisconnect();
                }}
                className='absolute inset-0 text-red-400 hover:text-red-300 transition-colors duration-300 ease-in-out'
              >
                <IconLogout size={24} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 