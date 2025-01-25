import { PROMPTS } from './prompts';
import { getVoiceName } from '@/app/voiceOptions';

export const BOT_READY_TIMEOUT = 15 * 1000;
export const DEMO_CALL_LIMIT = 5;
export const BOT_MAX_DURATION = 300;
export const defaultBotProfile = 'voice_2024_10';

export const LANGUAGES = [
  {
    label: 'English',
    value: 'en',
    tts_model: 'sonic-english',
    stt_model: 'nova-2-conversationalai',
  },
  {
    label: 'Spanish',
    value: 'es',
    tts_model: 'sonic-multilingual',
    stt_model: 'nova-2-general',
    default_voice: '846d6cb0-2301-48b6-9683-48f5618ea2f6',
  },
  {
    label: 'French',
    value: 'fr',
    tts_model: 'sonic-multilingual',
    stt_model: 'nova-2-general',
    default_voice: 'a8a1eb38-5f15-4c1d-8722-7ac0f329727d',
  },
  {
    label: 'German',
    value: 'de',
    tts_model: 'sonic-multilingual',
    stt_model: 'nova-2-general',
    default_voice: 'fb9fcab6-aba5-49ec-8d7e-3f1100296dde',
  },
];

export const defaultServices = {
  llm: 'openai',
  tts: 'cartesia',
  stt: 'deepgram',
};

function getCurrentDate() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function createBotConfig(
  prompt: string,
  voice: string,
  language = LANGUAGES[0],
  model = 'gpt-4o-mini',
  isCustomPrompt = false
) {
  const currentDate = getCurrentDate();
  const voiceName = getVoiceName(voice);
  const languageConfig = LANGUAGES.find((lang) => lang.value === language.value) || LANGUAGES[0];

  let finalPrompt: string;
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
      service: 'vad',
      options: [{ name: 'params', value: { stop_secs: 0.3 } }],
    },
    {
      service: 'tts',
      options: [
        { name: 'voice', value: voice },
        { name: 'model', value: languageConfig.tts_model },
        { name: 'language', value: languageConfig.value },
      ],
    },
    {
      service: 'llm',
      options: [
        { name: 'model', value: model },
        {
          name: 'initial_messages',
          value: [
            {
              role: 'system',
              content: finalPrompt
                .split('\n')
                .map((line) => line.trim())
                .join('\n'),
            },
          ],
        },
        { name: 'run_on_config', value: true },
      ],
    },
    {
      service: 'stt',
      options: [
        { name: 'model', value: languageConfig.stt_model },
        { name: 'language', value: languageConfig.value },
      ],
    },
  ];
}

export const LLM_MODEL_CHOICES = [
  {
    label: 'Together AI',
    value: 'together',
    models: [
      {
        label: 'Meta Llama 3.1 8B Instruct Turbo',
        value: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        description: 'Fast and efficient: good for lightweight conversations and basic tasks',
      },
      {
        label: 'Meta Llama 3.1 70B Instruct Turbo',
        value: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        description: 'Balanced: ideal for complex tasks and low latency',
      },
      {
        label: 'Meta Llama 3.1 405B Instruct Turbo',
        value: 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
        description: 'Most capable: best for complex tasks but with higher latency',
      },
    ],
  },
  {
    label: 'Anthropic',
    value: 'anthropic',
    models: [
      {
        label: 'Claude 3.5 Sonnet',
        value: 'claude-3-5-sonnet-20240620',
        description: 'Most capable: exceptional for complex prompts and tasks but with higher latency',
      },
    ],
  },
  {
    label: 'Open AI',
    value: 'openai',
    models: [
      {
        label: 'GPT-4o',
        value: 'gpt-4o',
        description: 'Most capable: excellent for complex prompts and tasks but with higher latency',
      },
      {
        label: 'GPT-4o Mini',
        value: 'gpt-4o-mini',
        description: 'Recommended for most use cases: provides a balance between latency and quality',
      },
    ],
  },
];

export const PROMPT_OPTIONS = [
  {
    label: 'Receptionist',
    secondaryLabel: 'Salon',
    value: 'receptionist',
    features: ['Book a haircut appointment at Style Hub Salon', 'Ask about services & pricing', 'Check salon hours, location'],
  },
  {
    label: 'Survey Caller',
    secondaryLabel: 'Tesla',
    value: 'surveyCaller',
    features: ['Talk with a Tesla customer experience specialist', 'Share feedback on your recent purchase of a Tesla Model S', 'Give feedback on specific features and performance'],
  },
  {
    label: 'Custom Prompt',
    secondaryLabel: 'Write your own',
    value: 'custom',
    features: ['Use your own custom prompt'],
  },
];

export const defaultConfigV2 = {
  llm: {
    model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
    messages: [
      {
        role: 'system',
        content: PROMPTS.receptionist,
      },
    ],
  },
  tts: {
    voice: LANGUAGES[0].default_voice,
  },
};

export const defaultMaxDuration = 600; 