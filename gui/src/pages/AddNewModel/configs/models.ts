import { ILLM } from "core";
import { ModelProviderTags } from "../../../components/modelSelection/utils";
import { InputDescriptor } from "./providers";

// A dimension is like parameter count - 7b, 13b, 34b, etc.
// You would set options to the field that should be changed for that option in the params field of ModelPackage
export interface PackageDimension {
  name: string;
  description: string;
  options: { [key: string]: { [key: string]: any } };
}

export interface DisplayInfo {
  title: string;
  icon?: string;
}

export interface ModelPackage {
  title: string;
  icon?: string;
  collectInputFor?: InputDescriptor[];
  description: string;
  refUrl?: string;
  tags?: ModelProviderTags[];
  params: {
    model: ILLM["model"];
    templateMessages?: ILLM["templateMessages"];
    contextLength: ILLM["contextLength"];
    stopTokens?: string[];
    promptTemplates?: ILLM["promptTemplates"];
    replace?: [string, string][];
    [key: string]: any;
  };
  dimensions?: PackageDimension[];
  providerOptions?: string[];
  isOpenSource: boolean;
}

export const models: { [key: string]: ModelPackage } = {
  deepseekV3Chat: {
    title: "deepseek v3",
    description: "A model from deekseek for chat",
    refUrl: "",
    params: {
      title: "deepseek_v3",
      model: "deepseek/deepseek_v3",
      contextLength: 2048,
    },
    icon: "deepseek.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          r1: {
            model: "deepseek/deepseek_v3",
            title: "deepseek_v3",
          },
        },
      },
    ],
    providerOptions: ["novita", "nebius"],
    isOpenSource: true,
  },
  deepseekR1Chat: {
    title: "deepseek r1",
    description: "A model from deekseek for chat",
    refUrl: "",
    params: {
      title: "deepseek-r1",
      model: "deepseek/deepseek-r1",
      contextLength: 2048,
    },
    icon: "deepseek.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          r1: {
            model: "deepseek/deepseek-r1",
            title: "deepseek-r1",
          },
        },
      },
    ],
    providerOptions: ["novita", "nebius"],
    isOpenSource: true,
  },
  llama318BChat: {
    title: "Llama 3.1 8B",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-8b",
      model: "meta-llama/llama-3.1-8b-instruct",
      contextLength: 8192,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "meta-llama/llama-3.1-8b-instruct",
            title: "Llama3.1-8b",
          },
        },
      },
    ],
    providerOptions: ["novita"],
    isOpenSource: true,
  },
  mistralChat: {
    title: "Mistral Chat",
    description:
      "A series of open-weight models created by Mistral AI, highly competent for code generation and other tasks",
    params: {
      title: "Mistral",
      model: "mistralai/mistral-7b-instruct",
      contextLength: 4096,
    },
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "mistralai/mistral-7b-instruct",
            title: "Mistral-7b",
          },
        },
      },
    ],
    icon: "mistral.png",
    providerOptions: ["novita"],
    isOpenSource: true,
  },
  llama31Chat: {
    title: "Llama3.1 Chat",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-8b",
      model: "llama3.1-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "llama3.1-8b",
            title: "Llama3.1-8b",
          },
          "70b": {
            model: "llama3.1-70b",
            title: "Llama3.1-70b",
          },
          "405b": {
            model: "llama3.1-405b",
            title: "Llama3.1-405b",
          },
        },
      },
    ],
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "llama.cpp",
      "replicate",
      "cerebras",
      "ovhcloud",
      "nebius",
      "scaleway",
    ],
    isOpenSource: true,
  },
  llama32Chat: {
    title: "Llama3.2 Chat",
    description:
      "The latest model from Meta, fine-tuned for chat. Llama3.1 recommended - chat stayed the same",
    refUrl: "",
    params: {
      title: "Llama3.2-11b",
      model: "llama3.2-11b",
      contextLength: 8192,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "1b": {
            model: "llama3.2-1b",
            title: "Llama3.2-1b",
          },
          "3b": {
            model: "llama3.2-3b",
            title: "Llama3.2-3b",
          },
          "11b": {
            model: "llama3.2-11b",
            title: "Llama3.2-11b",
          },
          "90b": {
            model: "llama3.2-90b",
            title: "Llama3.2-90b",
          },
        },
      },
    ],
    providerOptions: ["ollama", "groq", "llama.cpp"],
    isOpenSource: true,
  },
  deepseek: {
    title: "DeepSeek Coder",
    description:
      "A model pre-trained on 2 trillion tokens including 80+ programming languages and a repo-level corpus.",
    params: {
      title: "DeepSeek-7b",
      model: "deepseek-7b",
      contextLength: 4096,
    },
    icon: "deepseek.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "1b": {
            model: "deepseek-1b",
            title: "DeepSeek-1b",
          },
          "7b": {
            model: "deepseek-7b",
            title: "DeepSeek-7b",
          },
          "33b": {
            model: "deepseek-33b",
            title: "DeepSeek-33b",
          },
        },
      },
    ],
    providerOptions: ["ollama", "lmstudio", "llama.cpp"],
    isOpenSource: true,
  },
  deepseekChatApi: {
    title: "DeepSeek Chat",
    description: "DeepSeek's best model for general chat use cases.",
    params: {
      title: "DeepSeek Chat",
      model: "deepseek-chat",
      contextLength: 128_000,
    },
    icon: "deepseek.png",
    providerOptions: ["deepseek"],
    isOpenSource: false,
  },
  deepseekCoderApi: {
    title: "DeepSeek Coder",
    description:
      "A model pre-trained on 2 trillion tokens including 80+ programming languages and a repo-level corpus.",
    params: {
      title: "DeepSeek Coder",
      model: "deepseek-coder",
      contextLength: 128_000,
    },
    icon: "deepseek.png",
    providerOptions: ["deepseek"],
    isOpenSource: false,
  },
  deepseekReasonerApi: {
    title: "DeepSeek Reasoner",
    description:
      "An open-source reasoning model which generates a chain of thought to enhance the accuracy of its responses.",
    params: {
      title: "DeepSeek Reasoner",
      model: "deepseek-reasoner",
      contextLength: 64_000,
    },
    icon: "deepseek.png",
    providerOptions: ["deepseek"],
    isOpenSource: true,
  },
  deepseekCoder2Lite: {
    title: "DeepSeek Coder 2 Lite",
    description:
      "DeepSeek-Coder-V2-Lite-Instruct is an open-source code language model that supports 338 programming languages and offers a context length of up to 128,000 tokens.",
    params: {
      title: "DeepSeek-2-lite",
      model: "deepseek-2-lite",
      contextLength: 128_000,
    },
    icon: "deepseek.png",
    providerOptions: ["nebius"],
    isOpenSource: true,
  },
  moonshotChat: {
    title: "Moonshot Chat",
    description: "Moonshot AI provides high-performance large language models",
    refUrl: "https://platform.moonshot.cn/",
    params: {
      title: "Moonshot-v1-8k",
      model: "moonshot-v1-8k",
      contextLength: 8192,
    },
    icon: "moonshot.png",
    dimensions: [
      {
        name: "Context Window",
        description: "The size of the model's context window",
        options: {
          "8K": {
            model: "moonshot-v1-8k",
            title: "Moonshot-v1-8k",
            contextLength: 8192,
          },
          "32K": {
            model: "moonshot-v1-32k",
            title: "Moonshot-v1-32k",
            contextLength: 32768,
          },
          "128K": {
            model: "moonshot-v1-128k",
            title: "Moonshot-v1-128k",
            contextLength: 131072,
          },
        },
      },
    ],
    providerOptions: ["moonshot"],
    isOpenSource: false,
  },
  mistralOs: {
    title: "Mistral",
    description:
      "A series of open-weight models created by Mistral AI, highly competent for code generation and other tasks",
    params: {
      title: "Mistral",
      model: "mistral-7b",
      contextLength: 4096,
    },
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "mistral-7b",
            title: "Mistral-7b",
          },
          "8x7b (MoE)": {
            model: "mistral-8x7b",
            title: "Mixtral",
          },
          "8x22b (MoE)": {
            model: "mistral-8x22b",
            title: "Mixtral",
          },
        },
      },
    ],
    icon: "mistral.png",
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "ovhcloud",
      "llama.cpp",
      "replicate",
      "nebius",
    ],
    isOpenSource: true,
  },
  codeLlamaInstruct: {
    title: "CodeLlama Instruct",
    description:
      "A model from Meta, fine-tuned for code generation and conversation",
    refUrl: "",
    params: {
      title: "CodeLlama-7b",
      model: "codellama-7b",
      contextLength: 4096,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "codellama-7b",
            title: "CodeLlama-7b",
          },
          "13b": {
            model: "codellama-13b",
            title: "CodeLlama-13b",
          },
          "34b": {
            model: "codellama-34b",
            title: "CodeLlama-34b",
          },
          "70b": {
            model: "codellama-70b",
            title: "Codellama-70b",
          },
        },
      },
    ],
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "llama.cpp",
      "replicate",
    ],
    isOpenSource: true,
  },
  mixtralTrial: {
    title: "Mixtral (Free Trial)",
    description:
      "Mixtral 8x7b is a mixture of experts model created by Mistral AI",
    refUrl: "",
    params: {
      title: "Mixtral",
      model: "mistral-8x7b",
      contextLength: 4096,
    },
    icon: "mistral.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama38bChat: {
    title: "Llama3 8b",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3-8b",
      model: "llama3-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq"],
    isOpenSource: false,
  },
  llama370bChat: {
    title: "Llama3 70b Chat",
    description: "The latest Llama model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3-70b",
      model: "llama3-70b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq", "askSage"],
    isOpenSource: false,
  },
  llama318bChat: {
    title: "Llama3.1 8b Chat",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-8b",
      model: "llama3.1-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq", "scaleway", "nebius"],
    isOpenSource: false,
  },
  llama3370bChat: {
    title: "Llama3.3 70b Chat",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.3-70b",
      model: "llama3.3-70b",
      contextLength: 65536,
    },
    icon: "meta.png",
    providerOptions: ["ovhcloud"],
    isOpenSource: false,
  },
  llama3170bChat: {
    title: "Llama3.1 70b Chat",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-70b",
      model: "llama3.1-70b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq", "ovhcloud", "scaleway", "nebius"],
    isOpenSource: false,
  },
  llama31405bChat: {
    title: "Llama3.1 405b Chat",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.1-405b",
      model: "llama3.1-405b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["groq", "nebius"],
    isOpenSource: false,
  },
  llama3170bNemotron: {
    title: "Llama 3.1 Nemotron 70B",
    description:
      "Llama-3.1-Nemotron-70B-Instruct is a large language model customized by NVIDIA to improve the helpfulness of LLM generated responses to user queries.",
    params: {
      title: "Llama 3.1 Nemotron 70B",
      model: "llama3.1-70b-nemotron",
      contextLength: 128_000,
    },
    icon: "meta.png",
    isOpenSource: true,
  },
  llama321bChat: {
    title: "Llama3.2 1b Chat",
    description:
      "The latest super-lightweight model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.2-1b",
      model: "llama3.2-1b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["ollama", "groq", "llama.cpp", "sambanova", "nebius"],
    isOpenSource: false,
  },
  llama323bChat: {
    title: "Llama3.2 3b Chat",
    description: "The latest lightweight model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3.2-3b",
      model: "llama3.2-3b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["ollama", "groq", "llama.cpp", "sambanova", "together"],
    isOpenSource: false,
  },
  llama3211bChat: {
    title: "Llama3.2 11b Chat",
    description: "The latest lightweight multi-modal model from Meta",
    refUrl: "",
    params: {
      title: "Llama3.2-11b",
      model: "llama3.2-11b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["ollama", "groq", "llama.cpp", "together"],
    isOpenSource: false,
  },
  llama3290bChat: {
    title: "Llama3.2 90b Chat",
    description: "The latest lightweight multi-modal model from Meta",
    refUrl: "",
    params: {
      title: "Llama3.2-90b",
      model: "llama3.2-90b",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["ollama", "groq", "llama.cpp"],
    isOpenSource: false,
  },
  llama3Chat: {
    title: "Llama3 Chat",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama3-8b",
      model: "llama3-8b",
      contextLength: 8192,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "llama3-8b",
            title: "Llama3-8b",
          },
          "70b": {
            model: "llama3-70b",
            title: "Llama3-70b",
          },
        },
      },
    ],
    providerOptions: [
      "ollama",
      "lmstudio",
      "together",
      "ovhcloud",
      "llama.cpp",
      "replicate",
      "nebius",
    ],
    isOpenSource: true,
  },
  graniteCodeOpenSource: {
    title: "Granite Code",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "granite-code",
      contextLength: 20_000,
      title: "Granite Code",
      systemMessage: `You are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'day, morning, afternoon, evening, night, what's up, nice to meet you, sup, etc) with "Hello! I am Granite Chat, created by IBM. How can I help you today?". Please do not say anything else and do not start a conversation.`,
    },
    providerOptions: ["ollama", "lmstudio", "llama.cpp", "replicate"],
    icon: "ibm.png",
    isOpenSource: true,
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "3b": {
            model: "granite-code-3b",
            title: "Granite Code 3B",
          },
          "8b": {
            model: "granite-code-8b",
            title: "Granite Code 8B",
          },
          "20b": {
            model: "granite-code-20b",
            title: "Granite Code 20B",
          },
          "34b": {
            model: "granite-code-34b",
            title: "Granite Code 34B",
          },
        },
      },
    ],
  },
  wizardCoder: {
    title: "WizardCoder",
    description:
      "A CodeLlama-based code generation model from WizardLM, focused on Python",
    refUrl: "",
    params: {
      title: "WizardCoder-7b",
      model: "wizardcoder-7b",
      contextLength: 4096,
    },
    icon: "wizardlm.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "wizardcoder-7b",
            title: "WizardCoder-7b",
          },
          "13b": {
            model: "wizardcoder-13b",
            title: "WizardCoder-13b",
          },
          "34b": {
            model: "wizardcoder-34b",
            title: "WizardCoder-34b",
          },
        },
      },
    ],
    providerOptions: ["ollama", "lmstudio", "llama.cpp", "replicate"],
    isOpenSource: true,
  },
  phindCodeLlama: {
    title: "Phind CodeLlama (34b)",
    description: "A finetune of CodeLlama by Phind",
    icon: "meta.png",
    params: {
      title: "Phind CodeLlama",
      model: "phind-codellama-34b",
      contextLength: 4096,
    },
    providerOptions: ["ollama", "lmstudio", "llama.cpp", "replicate"],
    isOpenSource: true,
  },
  codestral: {
    title: "Codestral",
    description:
      "Codestral is an advanced generative model created by Mistral AI, tailored for coding tasks like fill-in-the-middle and code completion.",
    params: {
      title: "Codestral",
      model: "codestral-latest",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: true,
  },
  codestralMamba: {
    title: "Codestral Mamba",
    description: "A Mamba 2 language model specialized in code generation.",
    params: {
      title: "Codestral Mamba",
      model: "codestral-mamba-latest",
      contextLength: 256_000,
    },
    icon: "mistral.png",
    providerOptions: ["ovhcloud", "mistral"],
    isOpenSource: true,
  },
  mistral7b: {
    title: "Mistral 7B",
    description:
      "The first dense model released by Mistral AI, perfect for experimentation, customization, and quick iteration. At the time of the release, it matched the capabilities of models up to 30B parameters.",
    params: {
      title: "Mistral 7B",
      model: "open-mistral-7b",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistral8x7b: {
    title: "Mixtral 8x7B",
    description:
      "A sparse mixture of experts model. As such, it leverages up to 45B parameters but only uses about 12B during inference, leading to better inference throughput at the cost of more vRAM.",
    params: {
      title: "Mixtral 8x7B",
      model: "open-mixtral-8x7b",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistral8x22b: {
    title: "Mistral 8x22B",
    description:
      "A bigger sparse mixture of experts model. As such, it leverages up to 141B parameters but only uses about 39B during inference, leading to better inference throughput at the cost of more vRAM.",
    params: {
      title: "Mistral 8x22B",
      model: "open-mixtral-8x22b",
      contextLength: 64000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistralSmall: {
    title: "Mistral Small",
    description:
      "Suitable for simple tasks that one can do in bulk (Classification, Customer Support, or Text Generation)",
    params: {
      title: "Mistral Small",
      model: "mistral-small-latest",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral"],
    isOpenSource: false,
  },
  mistralLarge: {
    title: "Mistral Large",
    description:
      "Mistral's flagship model that's ideal for complex tasks that require large reasoning capabilities or are highly specialized (Synthetic Text Generation, Code Generation, RAG, or Agents).",
    params: {
      title: "Mistral Large",
      model: "mistral-large-latest",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["mistral", "askSage"],
    isOpenSource: false,
  },
  mistralNemo: {
    title: "Mistral Nemo",
    description:
      "Mistral Nemo Instruct is a large language model developed by Mistral AI and NVIDIA.",
    params: {
      title: "Mistral Nemo",
      model: "mistral-nemo",
      contextLength: 128_000,
    },
    icon: "mistral.png",
    isOpenSource: true,
  },
  geminiPro: {
    title: "Gemini Pro",
    description: "A highly capable model created by Google DeepMind",
    params: {
      title: "Gemini Pro",
      model: "gemini-pro",
      contextLength: 32_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini15Pro: {
    title: "Gemini 1.5 Pro",
    description: "A newer Gemini model with 1M token context length",
    params: {
      title: "Gemini 1.5 Pro",
      model: "gemini-1.5-pro-latest",
      contextLength: 2_000_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini", "askSage"],
    isOpenSource: false,
  },
  gemini15Flash: {
    title: "Gemini 1.5 Flash",
    description:
      "Fast and versatile multimodal model for scaling across diverse tasks",
    params: {
      title: "Gemini 1.5 Flash",
      model: "gemini-1.5-flash-latest",
      contextLength: 1_000_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini20Flash: {
    title: "Gemini 2.0 Flash",
    description:
      "Google's powerful workhorse model with low latency and enhanced performance.",
    params: {
      title: "Gemini 2.0 Flash",
      model: "gemini-2.0-flash",
      contextLength: 1_000_000,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini20FlashLite: {
    title: "Gemini 2.0 Flash Lite",
    description:
      "A more efficient version of Gemini 2.0 Flash optimized for faster responses and lower resource usage.",
    params: {
      title: "Gemini 2.0 Flash Lite",
      model: "gemini-2.0-flash-lite",
      contextLength: 1_048_576,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini20FlashImageGeneration: {
    title: "Gemini 2.0 Flash Image Generation",
    description:
      "A version of Gemini 2.0 Flash optimized for image generation capabilities.",
    params: {
      title: "Gemini 2.0 Flash Image Generation",
      model: "gemini-2.0-flash-exp-image-generation",
      contextLength: 32_768,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini25ProExp: {
    title: "Gemini 2.5 Pro Experimental",
    description:
      "Experimental version of Gemini 2.5 Pro with enhanced capabilities and larger output limits.",
    params: {
      title: "Gemini 2.5 Pro Experimental",
      model: "gemini-2.5-pro-exp-03-25",
      contextLength: 1_048_576,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  gemini25Pro: {
    title: "Gemini 2.5 Pro",
    description:
      "Google's thinking by default Pro model with up to 64k output context. Best for complex tasks involving reasoning.",
    params: {
      title: "Gemini 2.5 Pro",
      model: "gemini-2.5-pro",
      contextLength: 1_048_576,
      apiKey: "<API_KEY>",
    },
    icon: "gemini.png",
    providerOptions: ["gemini"],
    isOpenSource: false,
  },
  c4aiAyaExpanse8B: {
    title: "C4AI Aya Expanse 8B",
    description:
      "Aya Expanse is a massively multilingual large language model excelling in enterprise-scale tasks.",
    params: {
      model: "c4ai-aya-expanse-8b",
      contextLength: 8_000,
      title: "C4AI Aya Expanse 8B",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  c4aiAyaExpanse32B: {
    title: "C4AI Aya Expanse 32B",
    description:
      "Aya Expanse is a massively multilingual large language model excelling in enterprise-scale tasks.",
    params: {
      model: "c4ai-aya-expanse-32b",
      contextLength: 128_000,
      title: "C4AI Aya Expanse 32B",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  c4aiAyaVision8B: {
    title: "C4AI Aya Vision 8B",
    description:
      "Aya Vision is a state-of-the-art multimodal and massively multilingual large language model excelling at critical benchmarks for language, text, and image capabilities.",
    params: {
      model: "c4ai-aya-vision-8b",
      contextLength: 16_000,
      title: "C4AI Aya Vision 8B",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  c4aiAyaVision32B: {
    title: "C4AI Aya Vision 32B",
    description:
      "Aya Vision is a state-of-the-art multimodal and massively multilingual large language model excelling at critical benchmarks for language, text, and image capabilities.",
    params: {
      model: "c4ai-aya-vision-32b",
      contextLength: 16_000,
      title: "C4AI Aya Vision 32B",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandR032024: {
    title: "Command R 03-2024",
    description:
      "Command R is a scalable generative model targeting RAG and Tool Use to enable production-scale AI for enterprise.",
    params: {
      model: "command-r-03-2024",
      contextLength: 128_000,
      title: "Command R",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandRPlus042024: {
    title: "Command R+ 04-2024",
    description:
      "Command R+ is a state-of-the-art RAG-optimized model designed to tackle enterprise-grade workloads.",
    params: {
      model: "command-r-plus-04-2024",
      contextLength: 128_000,
      title: "Command R+",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandR082024: {
    title: "Command R 08-2024",
    description:
      "Command R is a scalable generative model targeting RAG and Tool Use to enable production-scale AI for enterprise.",
    params: {
      model: "command-r-08-2024",
      contextLength: 128_000,
      title: "Command R 08-2024",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandRPlus082024: {
    title: "Command R+ 08-2024",
    description:
      "Command R+ is a state-of-the-art RAG-optimized model designed to tackle enterprise-grade workloads.",
    params: {
      model: "command-r-plus-08-2024",
      contextLength: 128_000,
      title: "Command R+ 08-2024",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandR7B122024: {
    title: "Command R7B 12-2024",
    description:
      "The smallest model in our R series delivers top-tier speed, efficiency, and quality to build powerful AI applications on commodity GPUs and edge devices.",
    params: {
      model: "command-r7b-12-2024",
      contextLength: 128_000,
      title: "Command R7B 12-2024",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandR7BArabic022025: {
    title: "Command R7B Arabic 02-2025",
    description:
      "Our state-of-the-art lightweight multilingual AI model has been optimized for advanced Arabic language capabilities to support enterprises in the MENA region.",
    params: {
      model: "command-r7b-arabic-02-2025",
      contextLength: 128_000,
      title: "Command R7B Arabic 02-2025",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  commandA032025: {
    title: "Command A 03-2025",
    description:
      "Command A is Cohere’s most performant model to date, excelling at real world enterprise tasks including tool use, retrieval augmented generation (RAG), agents, and multilingual use cases.",
    params: {
      model: "command-a-03-2025",
      contextLength: 256_000,
      title: "Command A 03-2025",
      apiKey: "",
    },
    providerOptions: ["cohere"],
    icon: "cohere.png",
    isOpenSource: false,
  },
  gpt4turbo: {
    title: "GPT-4 Turbo",
    description:
      "A faster and more capable version of GPT-4 with longer context length and image support",
    params: {
      model: "gpt-4-turbo",
      contextLength: 128_000,
      title: "GPT-4 Turbo",
    },
    providerOptions: ["openai"],
    icon: "openai.png",
    isOpenSource: false,
  },
  gpt4o: {
    title: "GPT-4o",
    description:
      "An even faster version of GPT-4 with stronger multi-modal capabilities.",
    params: {
      model: "gpt-4o",
      contextLength: 128_000,
      title: "GPT-4o",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["openai", "askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  gpt4omini: {
    title: "GPT-4o Mini",
    description:
      "A model at less than half the price of gpt-3.5-turbo, but near gpt-4 in capabilities.",
    params: {
      model: "gpt-4o-mini",
      contextLength: 128_000,
      title: "GPT-4o mini",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["openai", "askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  gpt35turbo: {
    title: "GPT-3.5-Turbo",
    description:
      "A faster, cheaper OpenAI model with slightly lower capabilities",
    params: {
      model: "gpt-3.5-turbo",
      contextLength: 8096,
      title: "GPT-3.5-Turbo",
    },
    providerOptions: ["openai", "askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  claude35Sonnet: {
    title: "Claude 3.5 Sonnet",
    description:
      "Anthropic's most intelligent model, but much less expensive than Claude 3 Opus",
    params: {
      model: "claude-3-5-sonnet-latest",
      contextLength: 200_000,
      title: "Claude 3.5 Sonnet",
      apiKey: "",
    },
    providerOptions: ["anthropic", "askSage"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  claude3Opus: {
    title: "Claude 3 Opus",
    description:
      "The most capable model in the Claude 3 series, beating GPT-4 on many benchmarks",
    params: {
      model: "claude-3-opus-20240229",
      contextLength: 200_000,
      title: "Claude 3 Opus",
      apiKey: "",
    },
    providerOptions: ["anthropic", "askSage"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  claude3Sonnet: {
    title: "Claude 3 Sonnet",
    description:
      "The second most capable model in the Claude 3 series: ideal balance of intelligence and speed",
    params: {
      model: "claude-3-sonnet-20240229",
      contextLength: 200_000,
      title: "Claude 3 Sonnet",
      apiKey: "",
    },
    providerOptions: ["anthropic", "askSage"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  claude35Haiku: {
    title: "Claude 3.5 Haiku",
    description:
      "The fastest model in the Claude 3.5 series: a compact model for near-instant responsiveness",
    params: {
      model: "claude-3-5-haiku-latest",
      contextLength: 200_000,
      title: "Claude 3.5 Haiku",
      apiKey: "",
    },
    providerOptions: ["anthropic"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  graniteChat: {
    title: "Granite Chat 13b",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-13b-chat-v2",
      contextLength: 8_000,
      title: "Granite Chat 13b",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  graniteCode3b: {
    title: "Granite Code 3b",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-3b-code-instruct",
      contextLength: 2_000,
      title: "Granite Code 3b",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  graniteCode8b: {
    title: "Granite Code 8b",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-8b-code-instruct",
      contextLength: 4_000,
      title: "Granite Code 8b",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  graniteCode20b: {
    title: "Granite Code 20b",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-20b-code-instruct",
      contextLength: 8_000,
      title: "Granite Code 20b",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  graniteCode34b: {
    title: "Granite Code 34b",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-34b-code-instruct",
      contextLength: 8_000,
      title: "Granite Code 34b",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  granite3Instruct8b: {
    title: "Granite 3.0 8b Instruct",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-3-8b-instruct",
      contextLength: 8_000,
      title: "Granite 3.0 8b Instruct",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  granite3Instruct2b: {
    title: "Granite 3.0 2b Instruct",
    description:
      "The Granite model series is a family of IBM-trained, dense decoder-only models, which are particularly well-suited for generative tasks.",
    params: {
      model: "ibm/granite-3-2b-instruct",
      contextLength: 2_000,
      title: "Granite 3.0 2b Instruct",
    },
    providerOptions: ["watsonx"],
    icon: "WatsonX.png",
    isOpenSource: false,
  },
  MistralLarge: {
    title: "Mistral Large",
    description:
      "Mistral Large, the most advanced Large Language Model (LLM) developed by Mistral Al, is an exceptionally powerful model.",
    params: {
      model: "mistralai/mistral-large",
      contextLength: 20_000,
      title: "Mistral Large",
    },
    providerOptions: ["watsonx"],
    icon: "mistral.png",
    isOpenSource: false,
  },
  MetaLlama3: {
    title: "Llama 3.1",
    description:
      "Llama 3 is an auto-regressive language model that uses an optimized transformer architecture.",
    params: {
      title: "Llama 3.1",
      model: "meta-llama/llama-3-1-8b-instruct",
      contextLength: 20_000,
    },
    icon: "meta.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "8b": {
            model: "meta-llama/llama-3-1-8b-instruct",
            title: "Llama 3.1 8b",
          },
          "70b": {
            model: "meta-llama/llama-3-1-70b-instruct",
            title: "Llama 3.1 70b",
          },
        },
      },
    ],
    providerOptions: ["watsonx"],
    isOpenSource: false,
  },
  VertexGemini15Pro: {
    title: "Gemini 1.5 Pro",
    description: "A newer Gemini model with 1M token context length",
    params: {
      title: "Gemini 1.5 Pro",
      model: "gemini-1.5-pro-002",
      contextLength: 2_097_152,
    },
    icon: "gemini.png",
    providerOptions: ["vertexai"],
    isOpenSource: false,
  },
  VertexGemini15Flash: {
    title: "Gemini 1.5 Flash",
    description:
      "Fast and versatile multimodal model for scaling across diverse tasks",
    params: {
      title: "Gemini 1.5 Flash",
      model: "gemini-1.5-flash-002",
      contextLength: 1_048_576,
    },
    icon: "gemini.png",
    providerOptions: ["vertexai"],
    isOpenSource: false,
  },
  vertexMistralLarge: {
    title: "Mistral Large",
    description:
      "Mistral's flagship model that's ideal for complex tasks that require large reasoning capabilities or are highly specialized (Synthetic Text Generation, Code Generation, RAG, or Agents).",
    params: {
      title: "Mistral Large",
      model: "mistral-large",
      contextLength: 32000,
    },
    icon: "mistral.png",
    providerOptions: ["vertexai"],
    isOpenSource: false,
  },
  asksagegpt4gov: {
    title: "GPT-4 gov",
    description:
      "U.S. Government. Most capable model today - which is similar to GPT-4 but approved for use by the U.S. Government.",
    params: {
      model: "gpt4-gov",
      contextLength: 128_000,
      title: "GPT-4 gov",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.", // Need to set this on the Ask Sage side or just configure it in here to be discussed
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpt4ogov: {
    title: "GPT-4o gov",
    description:
      "U.S. Government. Most capable model today - which is similar to GPT-4o but approved for use by the U.S. Government.",
    params: {
      model: "gpt-4o-gov",
      contextLength: 128_000,
      title: "GPT-4o-gov",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.", // Need to set this on the Ask Sage side or just configure it in here to be discussed
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpt35gov: {
    title: "GPT-3.5-Turbo gov",
    description: "U.S. Government. Inexpensive and good ROI.",
    params: {
      model: "gpt-gov",
      contextLength: 8096,
      title: "GPT-3.5-Turbo gov",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.", // Need to set this on the Ask Sage side or just configure it in here to be discussed
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpt4ominigov: {
    title: "GPT-4o-mini gov",
    description:
      "U.S. Government. Latest OpenAI GPT 4o-mini model. More inexpensive than GPT4. Capable of ingesting and analyzing images (JPG, PNG, GIF (20MB files max)). 16,384 token response max.",
    params: {
      model: "gpt-4o-mini-gov",
      contextLength: 128_000,
      title: "GPT-4o-mini gov",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.", // Need to set this on the Ask Sage side or just configure it in here to be discussed
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpt4: {
    title: "GPT-4",
    description:
      "GPT4 is about 5X more expensive than Ask Sage tokens and 50X more expensive than GPT3.5",
    params: {
      model: "gpt4",
      contextLength: 8_192,
      title: "GPT-4",
    },
    providerOptions: ["openai"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpt432: {
    title: "GPT-4-32k",
    description:
      "The GPT-4-32k model is a variant of the GPT-4 model developed by OpenAI. It is designed to handle a larger context window, capable of processing up to 32,768 tokens, which makes it suitable for scenarios that require extensive information integration and data analysis",
    params: {
      model: "gpt4-32k",
      contextLength: 32_768,
      title: "GPT-4-32k",
    },
    providerOptions: ["openai"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpto1: {
    title: "GPT-o1",
    description:
      "Latest OpenAI GPT-o1 model. More inexpensive than GPT4. Capable of ingesting and analyzing images (JPG, PNG, GIF (20MB files max)).",
    params: {
      model: "gpt-o1",
      contextLength: 128_000,
      title: "GPT-o1",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpto1mini: {
    title: "GPT-o1-mini",
    description:
      "Latest OpenAI GPT-o1-mini model. More inexpensive than GPT-o1. Capable of ingesting and analyzing images (JPG, PNG, GIF (20MB files max)). 16,384 token response max.",
    params: {
      model: "gpt-o1-mini",
      contextLength: 128_000,
      title: "GPT-o1-mini",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksagegpto3mini: {
    title: "GPT-o3-mini",
    description:
      "o3-mini can outperform o1 in coding and other reasoning tasks, and is 93% cheaper and has lower latency. It supports function calling, Structured Outputs, streaming, and developer messages. o3-mini comes with a larger context window of 200,000 tokens and a max output of 100,000 tokens",
    params: {
      model: "gpt-o3-mini",
      contextLength: 200_000,
      title: "GPT-o3-mini",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["askSage"],
    icon: "openai.png",
    isOpenSource: false,
  },
  asksageclaude35gov: {
    title: "Claude 3.5 Sonnet gov",
    description:
      "Anthropic's most intelligent model, but much less expensive than Claude 3 Opus",
    params: {
      model: "aws-bedrock-claude-35-sonnet-gov",
      contextLength: 200_000,
      title: "Claude 3.5 Sonnet gov",
      systemMessage:
        "You are an expert software developer. You give helpful and concise responses.",
    },
    providerOptions: ["askSage"],
    icon: "anthropic.png",
    isOpenSource: false,
  },
  asksagegroqllama33: {
    title: "Llama 3.3",
    description: "Llama-3.3 is a large language model customized by Groq.",
    params: {
      title: "Llama 3.3",
      model: "groq-llama33",
      contextLength: 128_000,
    },
    icon: "groq.png",
    isOpenSource: true,
  },
  asksagegroq70b: {
    title: "Groq-70B",
    description: "A large language model customized by Groq.",
    params: {
      title: "Groq-70B",
      model: "groq-70b",
      contextLength: 8_192,
    },
    icon: "groq.png",
    isOpenSource: true,
  },
  Qwen2Coder: {
    title: "Qwen 2.5 Coder 7b",
    description:
      "Qwen 2.5 is an auto-regressive language model that uses an optimized transformer architecture.",
    params: {
      title: "Qwen 2.5 Coder 7b",
      model: "qwen-coder2.5-7b",
      contextLength: 32_000,
    },
    icon: "qwen.png",
    dimensions: [
      {
        name: "Parameter Count",
        description: "The number of parameters in the model",
        options: {
          "7b": {
            model: "qwen-coder2.5-7b",
            title: "Qwen 2.5 Coder 7b",
          },
        },
      },
    ],
    providerOptions: ["nebius", "ncompass"],
    isOpenSource: true,
  },
  Qwen25Coder32b: {
    title: "Qwen 2.5 Coder 32b",
    description:
      "Qwen 2.5 is an auto-regressive language model that uses an optimized transformer architecture.",
    params: {
      title: "Qwen 2.5 Coder 32b",
      model: "qwen2.5-coder-32b",
      contextLength: 32_000,
    },
    icon: "qwen.png",
    providerOptions: ["scaleway", "nebius", "ovhcloud", "ncompass"],
    isOpenSource: true,
  },
  grokBeta: {
    title: "Grok Beta",
    description: "Generative artificial intelligence chatbot developed by xAI.",
    refUrl: "",
    params: {
      title: "Grok Beta",
      model: "grok-beta",
      contextLength: 128_000,
    },
    icon: "xAI.png",
    providerOptions: ["xAI", "askSage"],
    isOpenSource: false,
  },
  gemma2_2b: {
    title: "Gemma 2 2b IT",
    description:
      "Gemma 2 IT instruction-tuned language model developed by Google, designed for tasks like question answering, summarization, and reasoning.",
    params: {
      title: "Gemma 2 2b IT",
      model: "gemma2-2b-it",
      contextLength: 4000,
    },
    isOpenSource: true,
  },
  gemma2_9b: {
    title: "Gemma 2 9b IT",
    description:
      "Gemma 2 IT instruction-tuned language model developed by Google, designed for tasks like question answering, summarization, and reasoning.",
    params: {
      title: "Gemma 2 9b IT",
      model: "gemma2-9b-it",
      contextLength: 8000,
    },
    isOpenSource: true,
  },
  phi3mini: {
    title: "Microsoft Phi 3 mini",
    description:
      "Phi 3 Mini is a 3.8-billion-parameter language model developed by Microsoft.",
    params: {
      title: "Microsoft Phi 3 mini",
      model: "phi-3-mini",
      contextLength: 4000,
    },
    isOpenSource: true,
  },
  phi3medium: {
    title: "Microsoft Phi 3 medium",
    description:
      "Phi 3 Medium is a 14-billion-parameter language model developed by Microsoft.",
    params: {
      title: "Microsoft Phi 3 medium",
      model: "phi-3-medium",
      contextLength: 128_000,
    },
    isOpenSource: true,
  },
  olmo7b: {
    title: "OLMo 7b",
    description:
      "OLMo 7B Instruct HF is a 7-billion-parameter language model by the Allen Institute for AI, fine-tuned for question answering tasks.",
    params: {
      title: "OLMo 7b",
      model: "olmo-7b",
      contextLength: 2000,
    },
    isOpenSource: true,
  },
  QwenQwQ_32b_preview: {
    title: "Qwen QwQ 32b Preview",
    description:
      "QwQ-32B-Preview is Qwen's latest experimental research model, focusing on improving AI reasoning capabilities.",
    params: {
      title: "Qwen QwQ 32b Preview",
      model: "Qwen/QwQ-32B-Preview",
      contextLength: 32_000,
    },
    icon: "qwen.png",
    providerOptions: ["siliconflow"],
    isOpenSource: true,
  },
  Qwen25Coder_32b: {
    title: "Qwen 2.5 Coder 32b",
    description:
      "Qwen 2.5 is an auto-regressive language model that uses an optimized transformer architecture.",
    params: {
      title: "Qwen 2.5 Coder 32b",
      model: "Qwen/Qwen2.5-Coder-32B-Instruct",
      contextLength: 128_000,
    },
    icon: "qwen.png",
    providerOptions: ["siliconflow"],
    isOpenSource: true,
  },
  Hunyuan_a52b: {
    title: "Hunyuan A52B",
    description:
      "Hunyuan-Large is the industry's largest open source Transformer architecture MoE model.",
    params: {
      title: "Hunyuan A52B",
      model: "Tencent/Hunyuan-A52B-Instruct",
      contextLength: 32_000,
    },
    icon: "hunyuan.png",
    providerOptions: ["siliconflow"],
    isOpenSource: true,
  },
  Llama31Nemotron_70b: {
    title: "Llama Nemotron 70B Instruct",
    description:
      "Llama-3.1-Nemotron-70B-Instruct is a large language model customized by NVIDIA, designed to improve the helpfulness of responses generated by LLM to user queries.",
    params: {
      title: "Llama Nemotron 70B Instruct",
      model: "nvidia/Llama-3.1-Nemotron-70B-Instruct",
      contextLength: 32_000,
    },
    icon: "nvidia.png",
    providerOptions: ["siliconflow"],
    isOpenSource: true,
  },
  llama4Scout: {
    title: "Llama 4 Scout Instruct",
    description: "A model from Meta, fine-tuned for chat",
    params: {
      title: "Llama 4 Scout Instruct",
      model: "Llama-4-Scout-17B-16E-Instruct",
      contextLength: 16_000,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  llama4Maverick: {
    title: "Llama 4 Maverick Instruct",
    description: "A model from Meta, fine-tuned for chat",
    params: {
      title: "Llama 4 Maverick Instruct",
      model: "Llama-4-Maverick-17B-128E-Instruct",
      contextLength: 16_000,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  llama3370BInstruct: {
    title: "Llama 3.3 70B Instruct",
    description: "A model from Meta, fine-tuned for chat",
    params: {
      title: "Llama 3.3 70B instruct",
      model: "Meta-Llama-3.3-70B-Instruct",
      contextLength: 128_000,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  llama318BInstruct: {
    title: "Llama3.1 8B",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama 3.1 8B Instruct",
      model: "Meta-Llama-3.1-8B-Instruct",
      contextLength: 16_000,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  llama31405BInstruct: {
    title: "Llama3.1 405B",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama 3.1 405B Instruct",
      model: "Meta-Llama-3.1-405B-Instruct",
      contextLength: 16_000,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  llama321BInstruct: {
    title: "Llama3.2 1B",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama 3.2 1B Instruct",
      model: "Meta-Llama-3.2-1B-Instruct",
      contextLength: 16_000,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  llama323BInstruct: {
    title: "Llama3.2 3B",
    description: "A model from Meta, fine-tuned for chat",
    refUrl: "",
    params: {
      title: "Llama 3.2 3B Instruct",
      model: "Meta-Llama-3.2-3B-Instruct",
      contextLength: 8192,
    },
    icon: "meta.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  qwq32B: {
    title: "QwQ 32B",
    description:
      "QwQ-32B is Qwen's latest experimental research model, focusing on improving AI reasoning capabilities.",
    params: {
      title: "QwQ 32B",
      model: "QwQ-32B",
      contextLength: 16_000,
    },
    icon: "qwen.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  deepseekR1DistillLlama70B: {
    title: "DeepSeek R1 Distill Llama 70B",
    description: "A llama 3.1 70 model distilled from deekseek R1",
    params: {
      title: "DeepSeek R1 Distill Llama 70B",
      model: "DeepSeek-R1-Distill-Llama-70B",
      contextLength: 32_000,
    },
    icon: "deepseek.png",
    providerOptions: ["ovhcloud", "sambanova"],
    isOpenSource: true,
  },
  deepseekR1: {
    title: "DeepSeek R1",
    description: "DeekSeek R1 reasoning model from DeepSeek",
    params: {
      title: "DeepSeek R1",
      model: "DeepSeek-R1",
      contextLength: 8192,
    },
    icon: "deepseek.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  deepseekV3: {
    title: "DeepSeek V3",
    description: "DeekSeek V3 reasoning model from DeepSeek",
    params: {
      title: "DeepSeek V3",
      model: "DeepSeek-V3-0324",
      contextLength: 8192,
    },
    icon: "deepseek.png",
    providerOptions: ["sambanova"],
    isOpenSource: true,
  },
  AUTODETECT: {
    title: "Autodetect",
    description:
      "Automatically populate the model list by calling the /models endpoint of the server",
    params: {
      model: "AUTODETECT",
    } as any,
    providerOptions: [],
    isOpenSource: false,
  },
};
