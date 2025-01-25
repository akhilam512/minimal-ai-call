// [POST] /api/bots-demo-web-call
import { defaultBotProfile, defaultMaxDuration } from "@/rtvi.config";
import { getSecurityHeaders } from "../utils";

export async function POST(request) {
  try {
    const { services, config } = await request.json();
    console.log("Request body:", { services, config });

    if (!services || !config || !process.env.DAILY_BOTS_URL) {
      console.log("Missing required data:", {
        services,
        config,
        DAILY_BOTS_URL: process.env.DAILY_BOTS_URL,
      });
      return new Response(`Services or config not found on request body`, {
        status: 400,
        headers: getSecurityHeaders(),
      });
    }

    const payload = {
      bot_profile: defaultBotProfile,
      max_duration: defaultMaxDuration,
      services,
      api_keys: {
        openai: process.env.OPENAI_API_KEY,
      },
      config,
    };

    // Convert the config object to the expected array format
    for (const [service, options] of Object.entries(config)) {
      for (const [key, value] of Object.entries(options)) {
        payload.config.push({ service, options: [{ name: key, value }] });
      }
    }

    const req = await fetch(process.env.DAILY_BOTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const res = await req.json();

    if (req.status !== 200) {
      console.log("Error response from Daily API:", res);
      return Response.json(res, {
        status: req.status,
        headers: getSecurityHeaders(),
      });
    }

    return Response.json(res, {
      headers: getSecurityHeaders(),
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return new Response("Internal Server Error", {
      status: 500,
      headers: getSecurityHeaders(),
    });
  }
}


// RTVIContext.js

"use client";

import React, {
  createContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { RTVIClient } from "@pipecat-ai/client-js";
import { DailyTransport } from "@pipecat-ai/daily-transport";
import { defaultServices, defaultConfigV2 } from "@/rtvi.config";
import { createBotConfig } from "@/rtvi.config";
import { LLMHelper, RTVIEvent, PipecatMetricsData } from "@pipecat-ai/client-js";
import { useRTVIClientEvent } from "@pipecat-ai/client-react";
import { RTVIClientProvider } from "@pipecat-ai/client-react";

export const RTVIContext = createContext();

let client;

export const RTVIProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [botConfig, setBotConfig] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [llmHelper, setLlmHelper] = useState(null);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const [selectedPrompt, setSelectedPrompt] = useState("receptionist");
  const [selectedVoice, setSelectedVoice] = useState(
    "b7d50908-b17c-442d-ad8d-810c63997ed9"
  );

  const [customPrompt, setCustomPrompt] = useState("");
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [isMinimalLoading, setIsMinimalLoading] = useState(false);

  // Create refs to store the functions
  const setIsLoadingRef = useRef(setIsLoading);
  const setCurrentPageRef = useRef(setCurrentPage);

  // Add cleanup function
  const cleanupClient = useCallback(() => {
    if (client) {
      // Unregister helper before disconnecting
      client.unregisterHelper("llm");
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
          baseUrl: process.env.NEXT_PUBLIC_BASE_URL || "/api",
          endpoints: {
            connect: "/bots-demo-web-call",
          },
          requestData: null,
          enableMic: true,
          enableCam: false,
        },
        timeout: 15 * 1000,
        callbacks: {
          onConnected: () => {
            console.log("[CALLBACK] User connected");
            setIsConnected(true);
            setIsMinimalLoading(false);
          },
          onDisconnected: () => {
            console.log("[CALLBACK] User disconnected");
            cleanupClient();
          },
          onTransportStateChanged: async (state) => {
            console.log("[CALLBACK] State change:", state);
            if (state === "ready") {
              // Initialize and register LLM helper when transport is ready
              if (!llmHelper) {
                const helper = new LLMHelper({});
                client.registerHelper("llm", helper);
                setLlmHelper(helper);
              }

              if (setIsLoadingRef.current) setIsLoadingRef.current(false);
              if (setCurrentPageRef.current) setCurrentPageRef.current(5);
              console.log("RTVICO: State change to ready");
            }
          },
          onBotConnected: () => {
            console.log("[CALLBACK] Bot connected");
          },
          onBotDisconnected: () => {
            console.log("[CALLBACK] Bot disconnected");
          },
          onBotReady: () => {
            console.log("[CALLBACK] Bot ready to chat!");
          },
        },
      });
    }
  }, [cleanupClient]);

  // Add error handling event listener
  useRTVIClientEvent(
    RTVIEvent.Error,
    useCallback((message) => {
      const errorData = message.data;
      console.error("RTVIContext Error:", errorData);
    }, [])
  );

  // Add transport state change listener
  useRTVIClientEvent(
    RTVIEvent.TransportStateChanged,
    useCallback((state) => {
      console.log("Transport State Changed:", state);
    }, [])
  );

  // Add bot events listeners
  useRTVIClientEvent(
    RTVIEvent.BotConnected,
    useCallback(() => {
      console.log("Bot Connected");
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotDisconnected,
    useCallback(() => {
      console.log("Bot Disconnected");
    }, [])
  );

  // Add both event listeners to debug
  useRTVIClientEvent(
    RTVIEvent.BotTranscript,
    useCallback((text) => {
      console.log("RTVIContext - Bot Transcript (enum):", text);
    }, [])
  );

  useRTVIClientEvent(
    RTVIEvent.BotTtsText,
    useCallback((text) => {
      console.log("RTVIContext - Bot TTS Text:", text);
    }, [])
  );

  const updateLLMContext = useCallback(
    async (messages, interrupt = false) => {
      if (!client) {
        console.error("Client not initialized");
        return;
      }

      try {
        console.log("Updating LLM Context:", messages);

        // Initialize helper if not already done
        if (!llmHelper) {
          console.log("Initializing new LLM Helper");
          const helper = new LLMHelper({});
          client.registerHelper("llm", helper);
          setLlmHelper(helper);
        }

        // Set the context using the messages array directly
        await llmHelper?.setContext(
          {
            messages: Array.isArray(messages)
              ? messages
              : [
                  {
                    role: "system",
                    content: messages,
                  },
                ],
          },
          interrupt
        );

        console.log("LLM Context updated successfully");
      } catch (error) {
        console.error("Error updating LLM context:", error);
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


// WebCallInterfaceMinimal.js

"use client";

import React, {
  useContext,
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { RTVIContext } from "../context/RTVIContext";
import { RTVIClientAudio, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { RTVIEvent, LLMHelper } from "@pipecat-ai/client-js";
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconArrowRight,
  IconCornerDownRight,
  IconLogout,
  IconAlertCircle,
  IconCircleCheck,
} from "@tabler/icons-react";
import { PROMPTS, DEMO_FUNCTIONS } from "../../../../prompts";
import { voiceGroupings, voicesByLanguage } from "../../../../voiceOptions";

// Helper function to get voice name from voice ID
const getVoiceName = (voiceId) => {
  // Search through all voices across all languages
  const voice = Object.values(voicesByLanguage)
    .flat()
    .find((v) => v.value === voiceId);

  return voice ? voice.label : "";
};

const DEFAULT_VOICE_ID = "5345cf08-6f37-424d-a5d9-8ae1101b9377"; // Maria

const LOADING_SUGGESTIONS = [
  "you are talking to a voice AI agent",
  "you can interrupt the agent anytime",
  "this demo is built on Pipecat hosted on Daily",
  "you can interrupt the agent anytime",
  "the AI can switch between different roles",
  "you can interrupt the agent anytime",
  "natural response times as low as 500ms",
  "you can interrupt the agent anytime",
  "the AI can switch between different roles",
  "powered by state-of-the-art LLMs",
];

// Analytics functions
async function trackConversationStart() {
  try {
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "start_conversation",
      }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.conversationId;
  } catch (error) {
    console.error("Error tracking conversation start:", error);
    return null;
  }
}

async function trackContextSwitch(conversationId, promptType) {
  try {
    const response = await fetch("/api/analytics", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "track_context_switch",
        conversationId,
        promptType,
      }),
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
  } catch (error) {
    console.error("Error tracking context switch:", error);
  }
}

// Add color mapping for different voice labels
const voiceColors = {
  female: [
    "bg-purple-100", // Light purple
    "bg-pink-100", // Soft pink
    "bg-red-100", // Red
    "bg-fuchsia-100", // Fuchsia
  ],
  male: [
    "bg-blue-100", // Light blue
    "bg-orange-100", // Sky blue
    "bg-yellow-100", // Indigo
    "bg-green-100", // Cyan
  ],
};

// Helper function to get color based on voice ID
const getVoiceColor = (voiceId) => {
  // Special case for demo bot voice (Maria)
  if (voiceId === DEFAULT_VOICE_ID) {
    return "bg-green-100"; // Hardcoded color for demo bot
  }

  const voice = Object.values(voicesByLanguage)
    .flat()
    .find((v) => v.value === voiceId);

  if (!voice) return "bg-blue-100"; // default color

  const gender = voice.labels[0]; // Get first label (male/female)
  if (!voiceColors[gender]) return "bg-blue-100";

  // Use the voice ID to deterministically select a color
  // Convert last character of voice ID to number and use modulo
  const lastChar = voiceId.slice(-1);
  const colorIndex = parseInt(lastChar, 16) % voiceColors[gender].length;
  return voiceColors[gender][colorIndex];
};

export default function WebCallInterfaceMinimal() {
  const { client, isConnected, setIsConnected, llmHelper } =
    useContext(RTVIContext);
  const [currentPromptType, setCurrentPromptType] = useState("demoBot");
  const [isInitializing, setIsInitializing] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lines, setLines] = useState([]);
  const [error, setError] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [systemMessageGroupId, setSystemMessageGroupId] = useState(0);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [isTransitioningText, setIsTransitioningText] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const volRef = useRef([]);
  const terminalRef = useRef(null);
  const currentAILineRef = useRef(null);
  const currentSentenceBufferRef = useRef("");
  const [connectingDots, setConnectingDots] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [listeningDots, setListeningDots] = useState("");
  const [hasSpokenOnce, setHasSpokenOnce] = useState(false);
  const [connectionState, setConnectionState] = useState("idle");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [
    isTransitioningConnectionMessage,
    setIsTransitioningConnectionMessage,
  ] = useState(false);
  const [currentVoiceId, setCurrentVoiceId] = useState(DEFAULT_VOICE_ID);

  // Add color mapping for different prompts
  const promptColors = {
    receptionist: "bg-green-100",
    sales_representative: "bg-emerald-100",
    survey_caller: "bg-pink-100",
    support_agent: "bg-pink-100",
    demoBot: "bg-blue-100", // default
  };

  // Rename 'scrollToTop' back to 'scrollToBottom' and adjust scrolling
  const scrollToBottom = useCallback(() => {
    if (terminalRef.current) {
      // Force a reflow to ensure content is rendered before scrolling
      terminalRef.current.scrollTop;
      setTimeout(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
          // Double-check scroll position after a brief delay
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

  // Add scroll observer
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

  // Add effect to scroll on lines change
  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  // Add a helper to check if a line is active
  const isLineActive = useCallback(
    (lineIndex) => {
      return (
        currentAILineRef.current === lineIndex ||
        (lineIndex === lines.length - 1 && lines[lineIndex]?.type === "ai")
      );
    },
    [lines, currentAILineRef.current]
  );

  // Add a helper function for system message positioning
  const handleSystemMessage = useCallback(
    (message, isFirstInGroup = false) => {
      if (isFirstInGroup) {
        setSystemMessageGroupId((prev) => prev + 1);
      }

      setLines((prev) => [
        ...prev,
        {
          type: "system",
          text: message,
          groupId: systemMessageGroupId,
        },
      ]);

      // Scroll to bottom after adding the message
      if (terminalRef.current) {
        setTimeout(() => {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }, 50);
      }
    },
    [systemMessageGroupId]
  );

  // Handle bot audio track events
  useRTVIClientEvent(
    RTVIEvent.BotStartedSpeaking,
    useCallback(() => {
      setIsTalking(true);
      setIsListening(false);
      setHasSpokenOnce(true);
      currentSentenceBufferRef.current = "";
      // Create new empty AI line when bot starts speaking
      setLines((prev) => {
        const newLines = [...prev];
        const newIndex = newLines.length;
        currentAILineRef.current = newIndex;
        return [
          ...newLines,
          {
            type: "ai",
            text: "",
            words: [],
            icon: "left",
            promptType: currentPromptType,
          },
        ];
      });
      scrollToBottom();
    }, [scrollToBottom, currentPromptType])
  );

  // Use BotTtsText for real-time word updates
  useRTVIClientEvent(
    "botTtsText",
    useCallback(
      (data) => {
        const text = typeof data === "string" ? data : data.text;

        if (!text || currentAILineRef.current === null) return;

        // Add new text to buffer and update current line immediately
        const newBuffer =
          currentSentenceBufferRef.current +
          (currentSentenceBufferRef.current ? " " : "") +
          text;
        currentSentenceBufferRef.current = newBuffer;

        // Set active word index
        const words = newBuffer.trim().split(" ");
        setActiveWordIndex(words.length - 1);

        // Always update the current line first
        setLines((prev) => {
          const newLines = [...prev];
          if (newLines[currentAILineRef.current]) {
            newLines[currentAILineRef.current] = {
              ...newLines[currentAILineRef.current],
              text: newBuffer.trim(),
              words: words,
            };
          }
          return newLines;
        });

        // Ensure scroll after content update
        requestAnimationFrame(scrollToBottom);

        // Check for formatting-based line breaks
        const shouldBreakLine = (buffer) => {
          // Break on list items (e.g., "1.", "a.", "•")
          if (
            buffer.match(/\d+\.\s*$/) ||
            buffer.match(/[a-z]\.\s*$/) ||
            buffer.endsWith("• ")
          )
            return true;

          // Break on question marks (usually indicates a new thought/question)
          if (buffer.endsWith("? ")) return true;

          // Break on long pauses (multiple spaces or ellipsis)
          if (buffer.endsWith("... ") || buffer.endsWith("   ")) return true;

          // Break on exclamations (usually indicates emphasis/new thought)
          if (buffer.endsWith("! ")) return true;

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
                    type: "ai",
                    text: "",
                    words: [],
                    icon: "left",
                    promptType: currentPromptType,
                  },
                ];
              });
              setActiveWordIndex(-1);
              scrollToBottom();
              currentSentenceBufferRef.current = "";
            }
          }, 50);
        }
      },
      [isTalking, scrollToBottom, currentPromptType]
    )
  );

  // Reset active word when bot stops speaking
  useRTVIClientEvent(
    RTVIEvent.BotStoppedSpeaking,
    useCallback(() => {
      setIsTalking(false);
      setIsListening(true);
      setActiveWordIndex(-1);

      // If there's any remaining text in the buffer, update the current line
      if (
        currentSentenceBufferRef.current.trim() &&
        currentAILineRef.current !== null
      ) {
        setLines((prev) => {
          const newLines = [...prev];
          if (newLines[currentAILineRef.current]) {
            if (!newLines[currentAILineRef.current].text) {
              newLines[currentAILineRef.current] = {
                ...newLines[currentAILineRef.current],
                text: currentSentenceBufferRef.current.trim(),
              };
              return newLines;
            }
          }
          return prev;
        });
      }

      currentSentenceBufferRef.current = "";
    }, [])
  );

  // Voice bar animation
  useEffect(() => {
    if (!isConnected || !isTalking) {
      volRef.current.forEach((bar) => {
        if (bar) bar.style.opacity = "0.1";
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
          const barVolume = Math.max(
            0.1,
            finalVolume * (1 - Math.abs(barPosition - 0.5))
          );
          bar.style.opacity = index < activeBars ? barVolume.toFixed(2) : "0.1";
        }
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isConnected, isTalking]);

  // Add connecting dots animation
  useEffect(() => {
    if (!isInitializing && !isListening) {
      setConnectingDots("");
      setListeningDots("");
      return;
    }

    const interval = setInterval(() => {
      if (isInitializing) {
        setConnectingDots((prev) => (prev === "..." ? "" : prev + "."));
      }
      if (isListening) {
        setListeningDots((prev) => (prev === "..." ? "" : prev + "."));
      }
    }, 300); // Faster animation for connecting dots

    return () => clearInterval(interval);
  }, [isInitializing, isListening]);

  // Add cycling connection messages with animation
  useEffect(() => {
    if (!isInitializing || connectionState === "requesting_permissions") {
      setConnectionMessage("");
      return;
    }

    const connectionMessages = [
      "initializing services",
      "connecting to the closest server",
    ];

    let messageIndex = 0;
    const messageInterval = setInterval(() => {
      if (messageIndex < connectionMessages.length) {
        setIsTransitioningConnectionMessage(true);
        setTimeout(() => {
          setConnectionMessage(connectionMessages[messageIndex]);
          setIsTransitioningConnectionMessage(false);
          messageIndex++;
        }, 200); // Wait for fade out before changing text
      }
    }, 1500);

    return () => clearInterval(messageInterval);
  }, [isInitializing, connectionState]);

  const handleStartCall = async () => {
    if (!client || isInitializing) return;

    setIsInitializing(true);
    setError("");
    setIsExpanded(true);
    setConnectionState("requesting_permissions");

    try {
      // Track conversation start
      const newConversationId = await trackConversationStart();
      setConversationId(newConversationId);

      await client.initDevices();

      // Fade out, then change state
      setIsTransitioningConnectionMessage(true);
      await new Promise((resolve) => setTimeout(resolve, 200));
      setConnectionState("connecting");
      setIsTransitioningConnectionMessage(false);

      const basicConfig = {
        name: "Demo Bot",
        config: [
          {
            service: "vad",
            options: [{ name: "params", value: { stop_secs: 0.3 } }],
          },
          {
            service: "tts",
            options: [
              { name: "voice", value: DEFAULT_VOICE_ID },
              { name: "model", value: "sonic-english" },
              { name: "language", value: "en" },
            ],
          },
          {
            service: "llm",
            options: [
              { name: "model", value: "gpt-4o" },
              {
                name: "initial_messages",
                value: [{ role: "system", content: PROMPTS.demoBot }],
              },
              { name: "tools", value: DEMO_FUNCTIONS },
              { name: "run_on_config", value: true },
            ],
          },
          {
            service: "stt",
            options: [
              { name: "model", value: "nova-2-conversationalai" },
              { name: "language", value: "en-US" },
            ],
          },
        ],
        services: {
          llm: "openai",
          tts: "cartesia",
          stt: "deepgram",
        },
      };

      console.log("Setting up bot with config:", {
        tools: DEMO_FUNCTIONS,
        prompt: PROMPTS.demoBot.substring(0, 200) + "...", // Log first 200 chars of prompt
      });

      client.params.requestData = basicConfig;

      try {
        await client.connect();

        // Wait for transport ready state
        await new Promise((resolve, reject) => {
          const checkState = () => {
            if (client.transport.state === "ready") {
              resolve();
            } else if (client.transport.state === "error") {
              reject(new Error("Transport error"));
            } else {
              setTimeout(checkState, 100);
            }
          };
          checkState();
        });

        clearInterval(messageInterval);
        setIsConnected(true);
        setIsInitializing(false);
        setConnectionState("connected");

        // Only show the connected message
        setLines([
          {
            type: "system",
            text: "Connected! You can now start talking to the AI assistant.",
            groupId: systemMessageGroupId,
          },
        ]);
      } catch (error) {
        clearInterval(messageInterval);
        throw error;
      }
    } catch (error) {
      console.error("Failed to start call:", error);
      setError("Failed to establish connection. Please try again.");
      setLines([]);
      setConnectionState("error");
    } finally {
      setIsInitializing(false);
    }
  };

  // Setup function call handler when llmHelper is available
  useEffect(() => {
    if (!llmHelper || !client) {
      console.log("No llmHelper or client available:", { llmHelper, client });
      return;
    }

    console.log("Setting up function call handler");
    const handler = async (fn) => {
      console.log("Function call received:", fn);

      if (fn.functionName === "log_uncertain_question") {
        const { question } = fn.arguments;
        console.log("Logging uncertain question:", question);

        try {
          console.log("Making request to /api/uncertain-questions");
          const response = await fetch("/api/uncertain-questions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              question,
              conversationId,
              promptType: currentPromptType,
            }),
          });

          const data = await response.json();
          console.log("Response from uncertain-questions API:", data);
          if (!data.success) throw new Error(data.error);

          return {
            status: "success",
            message: "Question logged successfully",
          };
        } catch (error) {
          console.error("Failed to log uncertain question:", error);
          return {
            status: "error",
            message: "Failed to log question",
            error: error.message,
          };
        }
      }

      if (fn.functionName === "select_demo_experience") {
        const { experience_type, reason } = fn.arguments;
        console.log("Handling select_demo_experience:", {
          experience_type,
          reason,
        });

        const promptKey = {
          sales_representative: "salesRepresentative",
          receptionist: "receptionist",
          survey_caller: "surveyCaller",
          support_agent: "supportAgent",
        }[experience_type];

        // Update the current prompt type to match promptColors keys
        const colorKey =
          {
            salesRepresentative: "sales_representative",
            receptionist: "receptionist",
            surveyCaller: "survey_caller",
            supportAgent: "support_agent",
          }[promptKey] || "demoBot";

        // Track both formats - one for colors and one for API
        setCurrentPromptType(promptKey || "demoBot");

        if (!promptKey || !PROMPTS[promptKey]) {
          console.error("Invalid experience type:", experience_type);
          return { error: "Invalid experience type" };
        }

        // Track context switch
        if (conversationId) {
          await trackContextSwitch(conversationId, promptKey);
        }

        setIsTransitioning(true);
        handleSystemMessage(
          `Function called: Switching to ${experience_type.replace(
            /_/g,
            " "
          )} demo...`,
          true
        );

        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          handleSystemMessage("Updating AI context and prompt...");

          const waitForBotToStop = new Promise((resolve) => {
            const handleBotStopped = () => {
              console.log("Bot stopped speaking, updating config...");
              resolve();
              client.off(RTVIEvent.BotStoppedSpeaking, handleBotStopped);
            };

            if (!isTalking) {
              resolve();
            } else {
              client.on(RTVIEvent.BotStoppedSpeaking, handleBotStopped);
            }
          });

          await waitForBotToStop;
          setLines((prev) => prev.filter((line) => line.type === "system"));

          // Get new random voice and update state
          const newVoiceId = await handleConfigUpdate(promptKey);

          console.log(
            "Updating config with new prompt and voice:",
            promptKey,
            newVoiceId
          );
          await client.updateConfig([
            {
              service: "llm",
              options: [
                {
                  name: "initial_messages",
                  value: [
                    {
                      role: "system",
                      content:
                        promptKey === "demoBot"
                          ? PROMPTS[promptKey]
                          : PROMPTS[promptKey].replace(
                              "{Your name}",
                              getVoiceName(newVoiceId)
                            ),
                    },
                  ],
                },
              ],
            },
            {
              service: "tts",
              options: [{ name: "voice", value: newVoiceId }],
            },
          ]);

          // Add final transition messages with delay
          await new Promise((resolve) => setTimeout(resolve, 800));
          handleSystemMessage(
            `Context updated successfully! Starting ${experience_type.replace(
              /_/g,
              " "
            )} demo...`
          );

          // Add small delay before welcome message
          await new Promise((resolve) => setTimeout(resolve, 1000));
          handleSystemMessage(
            `Welcome to the ${experience_type.replace(/_/g, " ")} demo!`
          );
          setIsTransitioning(false);

          return {
            status: "success",
            message: `Switched to ${experience_type.replace(/_/g, " ")} demo`,
            selected_experience: experience_type,
          };
        } catch (error) {
          console.error("Failed to update config:", error);
          handleSystemMessage("Error: Failed to update configuration");
          setIsTransitioning(false);
          return {
            status: "error",
            message: "Failed to update configuration",
            error: error.message,
          };
        }
      }
    };

    llmHelper.handleFunctionCall(handler);

    console.log("Function call handler registered successfully");

    return () => {
      console.log("Cleaning up function call handler");
      llmHelper.handleFunctionCall(null);
    };
  }, [
    llmHelper,
    client,
    isTalking,
    handleSystemMessage,
    systemMessageGroupId,
    conversationId,
    currentPromptType,
  ]);

  const handleDisconnect = async () => {
    if (!client) return;
    try {
      await client.disconnect();
      setIsConnected(false);
      setIsInitializing(false); // Ensure initializing state is cleared
      setIsExpanded(false);
      setLines([]);
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  // Push-to-talk handlers
  const toggleMic = async (e) => {
    e.stopPropagation();
    if (!client || !client.transport?.state === "ready") return;

    try {
      await client.enableMic(!isMicEnabled);
      setIsMicEnabled(!isMicEnabled);
    } catch (error) {
      console.error("Error toggling mic:", error);
    }
  };

  // Check initial mic state and listen for changes
  useEffect(() => {
    if (!client || !isConnected) return;

    // Initial state check
    const checkMicState = () => {
      try {
        const tracks = client.tracks();
        const isEnabled = tracks?.local?.audio?.enabled || false;
        setIsMicEnabled(isEnabled);
      } catch (error) {
        console.error("Error checking mic state:", error);
        setIsMicEnabled(false);
      }
    };

    // Check initial state
    checkMicState();

    // Listen for track changes
    const handleTrackEnabled = () => checkMicState();
    const handleTrackDisabled = () => checkMicState();

    if (client.transport) {
      client.transport.on("track:enabled", handleTrackEnabled);
      client.transport.on("track:disabled", handleTrackDisabled);
    }

    return () => {
      if (client.transport) {
        client.transport.off("track:enabled", handleTrackEnabled);
        client.transport.off("track:disabled", handleTrackDisabled);
      }
    };
  }, [client, isConnected]);

  // Add cycling suggestions effect with fade transition
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      setIsTransitioningText(true);
      setTimeout(() => {
        setCurrentSuggestionIndex(
          (prev) => (prev + 1) % LOADING_SUGGESTIONS.length
        );
        setIsTransitioningText(false);
      }, 500); // Wait for fade out before changing text
    }, 6000); // Change suggestion every 6 seconds

    return () => clearInterval(interval);
  }, [isConnected]);

  // Update the voice ID when config is updated
  const handleConfigUpdate = async (promptKey) => {
    // Get recommended voices for this prompt type
    const recommendedVoices =
      voiceGroupings[promptKey]?.recommended ||
      voiceGroupings.demoBot.recommended;

    // Filter out the current voice ID to ensure we don't select it again
    const availableVoices = recommendedVoices.filter(
      (voiceId) => voiceId !== currentVoiceId
    );

    // If somehow all voices were filtered out (shouldn't happen), use original list
    const voicesToSelectFrom =
      availableVoices.length > 0 ? availableVoices : recommendedVoices;

    // Select a random voice from the filtered list
    const randomVoice =
      voicesToSelectFrom[Math.floor(Math.random() * voicesToSelectFrom.length)];
    setCurrentVoiceId(randomVoice);
    return randomVoice;
  };

  return (
    <div className="w-full border-y bg-white border-black">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div
        className={`transition-all duration-500 ease-in-out ${
          isExpanded ? "h-[140px] opacity-100" : "h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="h-full bg-white font-mono text-sm">
          <div ref={terminalRef} className="h-[110px] overflow-y-auto pt-2">
            <div className="w-full px-4 pl-2 space-y-2 flex flex-col">
              {lines.map((line, i) => {
                if (line.type === "system") {
                  const isSuccessMessage = line.text
                    .toLowerCase()
                    .includes("success");
                  const isFirstMessage = i === 0;

                  return (
                    <div
                      key={i}
                      className={`flex items-center ${
                        isFirstMessage ? "mt-2" : ""
                      }`}
                    >
                      {isSuccessMessage ? (
                        <IconCircleCheck
                          className="text-green-500 mr-2"
                          size={20}
                        />
                      ) : (
                        <IconAlertCircle
                          className="text-yellow-500 mr-2"
                          size={20}
                        />
                      )}
                      <span className="font-mono text-xs text-gray-700">
                        {line.text}
                      </span>
                    </div>
                  );
                }

                const isActive = isLineActive(i);

                return (
                  <div key={i} className="flex items-start">
                    <span
                      className={`relative flex-1 text-black font-sans transition-all duration-700 ease-in-out transform ${
                        isActive
                          ? "mt-2 text-[22px] sm:text-[30px] leading-[1.2] translate-y-0 opacity-100"
                          : "text-[18px] sm:text-[20px] leading-[1.2] opacity-60 translate-y-1"
                      }`}
                    >
                      <span className="font-normal">
                        {line.words
                          ? line.words.map((word, wordIndex) => {
                              const isActiveWord =
                                isActive &&
                                activeWordIndex >= 0 &&
                                wordIndex === activeWordIndex;
                              const isWordVisible =
                                !isActive ||
                                activeWordIndex < 0 ||
                                wordIndex <= activeWordIndex;

                              return (
                                <React.Fragment key={wordIndex}>
                                  <span
                                    className={`${
                                      isActiveWord
                                        ? `${getVoiceColor(
                                            currentVoiceId
                                          )} opacity-100 rounded-md pl-1 pr-1 transform scale-105`
                                        : isWordVisible
                                        ? "opacity-100"
                                        : "opacity-0"
                                    } transition-all duration-300 ease-in-out transform-gpu will-change-transform`}
                                  >
                                    {word}
                                  </span>
                                  {wordIndex < line.words.length - 1 && (
                                    <span
                                      className={`${
                                        isWordVisible
                                          ? "opacity-100"
                                          : "opacity-0"
                                      } transition-all duration-300 ease-in-out transform-gpu will-change-transform`}
                                    >
                                      {" "}
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
        <div className="flex items-center px-2 pb-2 text-sm">
          <div className="flex-1 flex gap-0.5 h-1.5 items-stretch">
            {Array.from({ length: 50 }).map((_, index) => (
              <div
                key={index}
                ref={(el) => (volRef.current[index] = el)}
                className="flex-1 bg-black transition-all duration-150 ease-in-out"
                style={{ opacity: 0.1 }}
              />
            ))}
          </div>
        </div>
      )}

      <div
        className={`group relative flex items-center justify-between px-4 py-4 ${
          isConnected || isInitializing ? "border-t" : ""
        } border-black text-sm font-mono cursor-pointer transition-all duration-500 ease-in-out ${
          isConnected ? "bg-[#161618]" : "hover:bg-gray-50"
        }`}
        onClick={() => {
          if (!isConnected && !isInitializing) {
            handleStartCall();
          }
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <div
            className={`flex items-center select-none transition-all duration-500 ease-in-out transform min-h-[28px] ${
              isConnected ? "text-white text-base" : "text-black text-lg"
            } pr-24 sm:pr-32`}
          >
            <span
              className={`transition-all duration-500 ease-in-out ${
                isTransitioningText || isTransitioningConnectionMessage
                  ? "opacity-0"
                  : "opacity-100"
              }`}
            >
              {isConnected
                ? isListening && hasSpokenOnce
                  ? `Listening${listeningDots}`
                  : LOADING_SUGGESTIONS[currentSuggestionIndex]
                : isInitializing
                ? connectionState === "requesting_permissions"
                  ? `requesting microphone permissions${connectingDots}`
                  : `${connectionMessage || "connecting"}${connectingDots}`
                : "Try a live demo. Talk to a voice AI agent"}
            </span>
          </div>
        </div>

        <div
          className={`absolute right-0 top-0 bottom-0 flex items-center gap-2 sm:gap-4 transition-all duration-500 ease-in-out ${
            isConnected ? "bg-[#161618]" : ""
          } px-3 sm:px-6`}
        >
          <div className="relative">
            <IconMicrophone
              size={24}
              className={`transition-all duration-300 ease-in-out ${
                isInitializing ? "animate-pulse" : ""
              } ${!isConnected ? "opacity-100" : "opacity-0"}`}
            />
            {isConnected && (
              <button
                onClick={toggleMic}
                className="absolute inset-0 text-white transition-opacity duration-300 ease-in-out hover:opacity-80"
              >
                {isMicEnabled ? (
                  <IconMicrophone
                    size={24}
                    className="transition-all duration-300 ease-in-out"
                  />
                ) : (
                  <IconMicrophoneOff
                    size={24}
                    className="transition-all duration-300 ease-in-out"
                  />
                )}
              </button>
            )}
          </div>

          <div
            className={`h-6 w-px transition-all duration-500 ease-in-out ${
              isConnected ? "bg-white/20" : "bg-black/20"
            }`}
          />

          <div className="relative w-7 h-7">
            <IconArrowRight
              className={`absolute inset-0 w-7 h-7 transition-all duration-300 ease-in-out group-hover:translate-x-1 ${
                isConnected || isInitializing ? "opacity-0" : "opacity-100"
              }`}
              stroke={2}
            />
            {isInitializing && !isConnected && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-black dark:border-t-white dark:border-gray-600" />
              </div>
            )}
            {isConnected && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDisconnect();
                }}
                className="absolute inset-0 text-red-400 hover:text-red-300 transition-colors duration-300 ease-in-out"
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


// rtvi.config

import { PROMPTS } from './prompts';
import { getVoiceName } from './voiceOptions';

export const BOT_READY_TIMEOUT = 15 * 1000; // 15 seconds
export const DEMO_CALL_LIMIT = 5;
export const BOT_MAX_DURATION = 300;

export const defaultBotProfile = "voice_2024_10";

export const LANGUAGES = [
  {
    label: "English",
    value: "en",
    tts_model: "sonic-english",
    stt_model: "nova-2-conversationalai",
  },
  {
    label: "Spanish",
    value: "es",
    tts_model: "sonic-multilingual",
    stt_model: "nova-2-general",
    default_voice: "846d6cb0-2301-48b6-9683-48f5618ea2f6",
  },
  {
    label: "French", 
    value: "fr",
    tts_model: "sonic-multilingual",
    stt_model: "nova-2-general",
    default_voice: "a8a1eb38-5f15-4c1d-8722-7ac0f329727d",
  },
  {
    label: "German",
    value: "de",
    tts_model: "sonic-multilingual", 
    stt_model: "nova-2-general",
    default_voice: "fb9fcab6-aba5-49ec-8d7e-3f1100296dde",
  },
];

export const defaultServices = {
  llm: "openai",
  tts: "cartesia",
  stt: "deepgram",
};

function getCurrentDate() {
  const now = new Date();
  return now.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Helper function to create bot-specific configuration
export const createBotConfig = (prompt, voice, language = LANGUAGES[0], model = "gpt-4o-mini", isCustomPrompt = false) => {
  const currentDate = getCurrentDate();
  const voiceName = getVoiceName(voice);
  
  // Ensure we have valid language config
  const languageConfig = LANGUAGES.find(lang => lang.value === language.value) || LANGUAGES[0];
  
  let finalPrompt;
  if (isCustomPrompt) {
    finalPrompt = `Today's date: ${currentDate}
Your name: ${voiceName}
Language: ${languageConfig.label}

You are an AI voice agent so remember to be conversational and keep your responses brief. Please communicate in ${languageConfig.label}. To start - greet the user with a concise introduction.

${prompt}`;
  } else {
    finalPrompt = `Today's date: ${currentDate}
Your name: ${voiceName}
Language: ${languageConfig.label}

Please communicate in ${languageConfig.label}.

${prompt}`;
  }

  return [
    { 
      service: "vad", 
      options: [{ name: "params", value: { stop_secs: 0.3 } }] 
    },
    {
      service: "tts",
      options: [
        { name: "voice", value: voice },
        { name: "model", value: languageConfig.tts_model },
        { name: "language", value: languageConfig.value },
      ],
    },
    {
      service: "llm",
      options: [
        { name: "model", value: model },
        {
          name: "initial_messages",
          value: [
            {
              role: "system",
              content: finalPrompt.split('\n').map(line => line.trim()).join('\n'),
            },
          ],
        },
        { name: "run_on_config", value: true },
      ],
    },
    {
      service: "stt",
      options: [
        { name: "model", value: languageConfig.stt_model },
        { name: "language", value: languageConfig.value },
      ],
    },
  ];
};

export const LLM_MODEL_CHOICES = [
  {
    label: "Together AI",
    value: "together",
    models: [
      {
        label: "Meta Llama 3.1 8B Instruct Turbo",
        value: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        description: "Fast and efficient: good for lightweight conversations and basic tasks",
      },
      {
        label: "Meta Llama 3.1 70B Instruct Turbo",
        value: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
        description: "Balanced: ideal for complex tasks and low latency",
      },
      {
        label: "Meta Llama 3.1 405B Instruct Turbo",
        value: "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
        description: "Most capable: best for complex tasks but with higher latency",
      },
    ],
  },
  {
    label: "Anthropic",
    value: "anthropic",
    models: [
      {
        label: "Claude 3.5 Sonnet",
        value: "claude-3-5-sonnet-20240620",
        description: "Most capable: exceptional for complex prompts and tasks but with higher latency",
      },
    ],
  },
  {
    label: "Open AI",
    value: "openai",
    models: [
      {
        label: "GPT-4o",
        value: "gpt-4o",
        description: "Most capable: excellent for complex prompts and tasks but with higher latency",
      },
      {
        label: "GPT-4o Mini",
        value: "gpt-4o-mini",
        description: "Recommended for most use cases: provides a balance between latency and quality",
      },
    ],
  },
];

export const PROMPT_OPTIONS = [
  { 
    label: "Receptionist",
    secondaryLabel: "Salon",
    value: "receptionist",
    features: [
      "Book a haircut appointment at Style Hub Salon",
      "Ask about services & pricing",
      "Check salon hours, location"
    ]
  },
  { 
    label: "Survey Caller",
    secondaryLabel: "Tesla",
    value: "surveyCaller", 
    features: [
      "Talk with a Tesla customer experience specialist",
      "Share feedback on your recent purchase of a Tesla Model S",
      "Give feedback on specific features and performance"
    ] 
  },
  { 
    label: "Custom Prompt",
    secondaryLabel: "Write your own",
    value: "custom",
    features: ["Use your own custom prompt"]
  },
];

export const defaultConfigV2 = {
  llm: {
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
    messages: [
      {
        role: "system",
        content: PROMPTS.receptionist
      },
    ],
  },
  tts: {
    voice: LANGUAGES[0].default_voice,
  },
};

export const defaultMaxDuration = 600;

// prompts.js

const getTodayDate = () => {
    const today = new Date();
    return today.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };
  
  const prependDate = (prompt) => {
    return `Today's date: ${getTodayDate()}\n\n${prompt}`;
  };
  
  export const DEMO_FUNCTIONS = [
    {
      type: "function",
      function: {
        name: "select_demo_experience",
        description: "Select a demo experience based on the user's interests",
        parameters: {
          type: "object",
          properties: {
            experience_type: {
              type: "string",
              enum: [
                "sales_representative",
                "receptionist",
                "survey_caller",
                "support_agent",
              ],
              description: "The type of demo experience to select",
            },
            reason: {
              type: "string",
              description:
                "Brief explanation of why this demo experience was selected",
            },
          },
          required: ["experience_type", "reason"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "log_uncertain_question",
        description:
          "Log a user's question that is not present in the knowledge base but still relevant to Daily, Pipecat or Voice AI",
        parameters: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description:
                "The user's question that is not present in the knowledge base but still relevant to Daily, Pipecat or Voice AI",
            },
          },
          required: ["question"],
        },
      },
    },
  ];
  
  export const PROMPTS = {
    demoBot: prependDate(`
  You are a real-time voice AI agent built on an open source framework called "Pipecat", demonstrating practical voice AI workflows.
  
  # CORE OBJECTIVE
  
  Direct users to the most relevant demo experience efficiently and naturally. Additionally, help answer any questions about Pipecat and Daily.
  
  # AVAILABLE DEMOS
  
  - Sales Representative - Pipecat and Daily platform overview
  - Receptionist - Hair salon appointment scheduling
  - Survey Caller - Tesla customer experience surveys
  - Support Agent - IT customer support
  
  # RESPONSE REQUIREMENTS
  
  - Keep responses natural, direct, casual but brief
  - Avoid repeating or including the user's name in your responses
  - Begin with one clear point addressing what was asked
  - Overcome transcription errors: If you mishear, use phrases like "I didn't catch that, could you repeat?" without mentioning "transcription errors.". When you mishear, never repeat the transcript back to the user.
  - Add a maximum of one follow-up detail if valuable
  - Ask one question to move the conversation forward
  - Never repeat or rephrase information
  - Never restate what the user said
  - Avoid connector phrases (also, additionally, furthermore)
  - Use brief phrases like "Interesting" or "Great question"
  - Keep acknowledgments professional and brief
  - Focus on the topic, not emotional support
  - Avoid overly familiar phrases
  - Avoid listing or outputting bullet points
  - Stay within your capabilities, avoid steering off topic keeping the conversation focused on Daily, Pipecat, Voice AI, and the demos
  
  # CONVERSATION FLOW
  
  ## Opening
  
  "Hey, I'm Chloe and I'll be demoing voice AI with you. Who am I talking with today?"
  
  ## After user introduces themselves
  
  - If just introduction: "Nice to meet you. Voice AI can handle all kinds of conversations. For example, I can demo a scheduling assistant, survey caller, sales representative, or a support agent. Would you like to demo one of these?". Avoid repeating the user’s name in your response.
  - If they ask a question: Provide a brief answer, then gently steer the conversation back to the demos.
  
  ## Demo Selection
  
  - Sales mention → Sales Representative demo
  - Scheduling/appointments → Receptionist demo
  - Surveys/feedback → Survey Caller demo
  - Support → Support Agent demo
  - Unclear preference → "What outcomes are you hoping to achieve with voice AI?"
  
  ## Uncertain Questions
  
  - When the user asks a question outside the provided knowledge base but still relevant to Daily, Pipecat or Voice AI - call the log_uncertain_question(question) function with the user's question
  - When the user asks a question that is completely unrelated to Daily, Pipecat, the demos, or Voice AI - gently steer the conversation back to the demos
  
  # FUNCTION CALLING PROTOCOL
  
  You have access to execute two functions:
  
  1. select_demo_experience(experience_type, reason)
  - Upon clear user preference, call select_demo_experience with chosen demo
  - Briefly explain selection rationale in one sentence
  - Execute handoff to selected demo experience
  
  2. log_uncertain_question(question)
  - When the user asks a question that is not present in the provided knowledge base but is still relevant to Daily, Pipecat, Voice AI or the demos - call the log_uncertain_question(question) function with the user's question
  - Briefly record the question in one sentence
  
  ## Example Function Flows
  
  Example 1:
  User: "I'm interested in appointment scheduling"
  Assistant: "The receptionist demo perfectly fits scheduling workflows. Let me connect you."
  Calls select_demo_experience("receptionist")
  
  Example 2:
  User: "I'm interested in learning more about the platform"
  Assistant: "The sales demo is the best way to learn about Daily and Pipecat. Let me connect you."
  Calls select_demo_experience("sales_representative")
  
  Example 3:
  User: "How do you compare against other voice AI platforms?"
  Assistant: "Our sales demo can probably answer your question best. Let me connect you!"
  Calls select_demo_experience("sales_representative")
  
  Example 4:
  User: "Who's the president of the United States?"
  Assistant: "I don't know! I'm designed to help you with Daily, Pipecat, and Voice AI demos. Is there a particular type of conversation you'd like to explore today?"
  
  Example 5:
  User: "Where is Daily's headquarters?"
  Assistant: "I'm not sure! I've logged your question so we can get this right for you next time. In the meantime, is there a particular type of conversation you'd like to explore today?"
  Calls log_uncertain_question("Where is Daily's headquarters?")
  
  Example 6:
  User: "Does Pipecat support X service/model?"
  Assistant: "I'm not sure! I've logged your question so we can get this right for you next time. In the meantime, is there a particular type of conversation you'd like to explore today? For example, our sales demo can answer questions about Pipecat in more detail."
  Calls log_uncertain_question("Does Pipecat support X service/model?")
  
  Example 7:
  User: "Does Daily and Pipecat support HIPAA?"
  Assistant: "I'm not sure! I've logged your question so we can get this right for you next time. In the meantime, is there a particular type of conversation you'd like to explore today? For example, our sales demo can answer questions about Daily in more detail."
  Calls log_uncertain_question("Does Daily and Pipecat support HIPAA?")
  
  Example 8:
  User: "What's your latency in South America?"
  Assistant: "I'm not sure! I've logged your question so we can get this right for you next time. In the meantime, is there a particular type of conversation you'd like to explore today? For example, our sales demo can answer questions about Daily in more detail."
  Calls log_uncertain_question("What's your latency in South America?")
  
  
  # EXAMPLE SCENARIOS
  
  - If user mentions interest in Pipecat → Calls select_demo_experience("sales_representative")
  - If user mentions scheduling/appointments → Calls select_demo_experience("receptionist")
  - If user mentions surveys/feedback → Calls select_demo_experience("survey_caller")
  - If user mentions customer support → Calls select_demo_experience("support_agent")
  - If user is unsure → Ask about their use case needs first
  - If user asks a question you're not sure about → Calls log_uncertain_question(question) with the question as a parameter
  
  # RESPONSE EXAMPLES
  
  ## BAD RESPONSE EXAMPLE
  
  "That's wonderful! Let me tell you all about our demos. First, we have a sales representative demo that shows how AI can handle sales calls, and we also have a receptionist demo for appointments, and finally there's our survey demo. Which one would you like to learn more about?"
  
  ## GOOD RESPONSE EXAMPLE
  
  "The receptionist demo shows how AI handles salon scheduling. Connecting you now."
  Calls select_demo_experience("receptionist")
  
  "I'm not sure about that one - but I've logged your question so we can get this right for you next time."
  Calls log_uncertain_question("example uncertain question")
  
  Remember: Your goal is to quickly understand the user's needs and connect them to the most relevant demo experience through clear, concise interaction and proper function calling.
  
  # KNOWLEDGE BASE
  
  ## ABOUT PIPECAT AND DAILY
  
  To help answer questions about Pipecat and Daily, you can use the following information:
  
  Here's what you do know:
  - Pipecat is the most widely used agentic framework for voice and multimodal AI. 
  - It handles all the complexity of building a voice and video AI agent. 
  - Pipecat is  vendor-neutral voice AI framework. It supports WebRTC, WebSocket, SIP/telephone, and HTTP network transport. 
  - Pipecat has built-in implementations of 40+ AI models and services. It supports fine-tuned models and custom inference endpoints.
  - Pipecat is maintained by the engineering team at Daily with contributions from the Pipecat community.
  - Pipecat is licensed under the BSD 2-Clause License.
  
  - Daily is a real-time voice, video, and AI platform. It's the team behind Pipecat.
  - Since 2016, Daily has been providing battle-tested WebRTC infrastructure for real-time video and voice.
  - Daily has a global network of 75 points of presence, offering a 13ms first hop latency to 5 billion users.
  - Daily works with companies like NVIDIA, Google, Accenture, Pinterest, and many more.
  - Daily also offers WebRTC-based voice and video calling APIs and SDKs for human-to-human and human-to-human calling.
  
  ## WHY PIPECAT AND DAILY?
  
  A production-ready conversational voice agent requires the integration of several complex components, including multiple AI models (such as STT, LLM, TTS, and guardrails), conversation context management, and frameworks for state management and legacy system integration. 
  
  Additionally, it involves handling hooks for RAG, phrase endpointing, interruption management, ultra-low latency network transport, echo cancellation, and background noise reduction. The solution also requires integration with telephony systems, client-side SDKs for connection management and multimedia exchange, and integration with evaluation and observability tools. All these elements must be managed to ensure conversational latency (500-1500ms for voice-to-voice responses).
  
  Pipecat addresses these challenges, supporting 40+ AI models and services as plugins and offering SDKs for various platforms including Python, JavaScript, React, iOS, Android, and C++.
   `),
};
