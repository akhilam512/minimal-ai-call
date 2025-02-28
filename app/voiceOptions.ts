// Define the voice option type
export type VoiceOption = {
  value: string;
  label: string;
  useVoiceLabelName?: boolean;
  labels: string[];
  language: string;
};

// Only keeping English voices since that's what's being used
export const voiceOptions: VoiceOption[] = [
  {
    value: "5345cf08-6f37-424d-a5d9-8ae1101b9377",
    label: "Maria",
    useVoiceLabelName: true,
    labels: ["female", "helpful", "professional"],
    language: "en",
  },
  {
    value: "b7d50908-b17c-442d-ad8d-810c63997ed9",
    label: "California Girl",
    useVoiceLabelName: true,
    labels: ["female", "friendly", "casual"],
    language: "en",
  },
  {
    value: "156fb8d2-335b-4950-9cb3-a2d33befec77",
    label: "Helpful Woman",
    useVoiceLabelName: true,
    labels: ["female", "helpful", "professional"],
    language: "en",
  },
  {
    value: "63ff761f-c1e8-414b-b969-d1833d1c870c",
    label: "Confident British Man",
    useVoiceLabelName: true,
    labels: ["male", "british", "professional"],
    language: "en",
  },
  {
    value: "694f9389-aac1-45b6-b726-9d9369183238",
    label: "Sarah",
    useVoiceLabelName: true,
    labels: ["female", "friendly", "professional"],
    language: "en",
  },
  {
    value: "ee7ea9f8-c0c1-498c-9279-764d6b56d189",
    label: "Polite Man",
    useVoiceLabelName: true,
    labels: ["male", "polite", "professional"],
    language: "en",
  }
];

// Create a map of all voices by language
export const voicesByLanguage: Record<string, VoiceOption[]> = {
  en: voiceOptions,
};

// Function to get voice name by ID
export const getVoiceName = (voiceId: string): string => {
  const voice = Object.values(voicesByLanguage)
    .flat()
    .find((v) => v.value === voiceId);

  return voice ? voice.label : "Cameron";
};

// Voice groupings for different prompt types
export const voiceGroupings: Record<string, { recommended: string[] }> = {
  demoBot: {
    recommended: [
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
      "b7d50908-b17c-442d-ad8d-810c63997ed9", // California Girl
      "156fb8d2-335b-4950-9cb3-a2d33befec77", // Helpful Woman
      "63ff761f-c1e8-414b-b969-d1833d1c870c", // Confident British Man
    ],
  },
  salesRepresentative: {
    recommended: [
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
      "156fb8d2-335b-4950-9cb3-a2d33befec77", // Helpful Woman
      "63ff761f-c1e8-414b-b969-d1833d1c870c", // Confident British Man
      "694f9389-aac1-45b6-b726-9d9369183238", // Sarah
    ],
  },
  receptionist: {
    recommended: [
      "b7d50908-b17c-442d-ad8d-810c63997ed9", // California Girl
      "694f9389-aac1-45b6-b726-9d9369183238", // Sarah
      "ee7ea9f8-c0c1-498c-9279-764d6b56d189", // Polite Man
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
      "156fb8d2-335b-4950-9cb3-a2d33befec77", // Helpful Woman
    ],
  },
  appointmentScheduler: {
    recommended: [
      "b7d50908-b17c-442d-ad8d-810c63997ed9", // California Girl
      "ee7ea9f8-c0c1-498c-9279-764d6b56d189", // Polite Man
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
      "694f9389-aac1-45b6-b726-9d9369183238", // Sarah
    ],
  },
  surveyCaller: {
    recommended: [
      "156fb8d2-335b-4950-9cb3-a2d33befec77", // Helpful Woman
      "b7d50908-b17c-442d-ad8d-810c63997ed9", // California Girl
      "694f9389-aac1-45b6-b726-9d9369183238", // Sarah
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
    ],
  },
  custom: {
    recommended: [
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
      "b7d50908-b17c-442d-ad8d-810c63997ed9", // California Girl
      "ee7ea9f8-c0c1-498c-9279-764d6b56d189", // Polite Man
      "694f9389-aac1-45b6-b726-9d9369183238", // Sarah
    ],
  },
  supportAgent: {
    recommended: [
      "156fb8d2-335b-4950-9cb3-a2d33befec77", // Helpful Woman
      "694f9389-aac1-45b6-b726-9d9369183238", // Sarah
      "ee7ea9f8-c0c1-498c-9279-764d6b56d189", // Polite Man
      "5345cf08-6f37-424d-a5d9-8ae1101b9377", // Maria
    ],
  },
};

// Helper function to get grouped voices by prompt type
export const getGroupedVoices = (promptType: string) => {
  const recommendedIds = voiceGroupings[promptType]?.recommended || [];

  const groups = [
    {
      label: "Recommended",
      options: voiceOptions.filter((voice) =>
        recommendedIds.includes(voice.value)
      ),
    },
    {
      label: "Female Voices",
      options: voiceOptions.filter(
        (voice) =>
          voice.labels.includes("female") &&
          !recommendedIds.includes(voice.value)
      ),
    },
    {
      label: "Male Voices",
      options: voiceOptions.filter(
        (voice) =>
          voice.labels.includes("male") && !recommendedIds.includes(voice.value)
      ),
    },
  ];

  return groups.filter((group) => group.options.length > 0);
};
  