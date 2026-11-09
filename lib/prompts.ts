import type { Locale } from "@/lib/i18n";

export type Goal = "interview" | "exam" | "everyday";
export type Level = "A2" | "B1" | "B2";

type PromptSet = Record<Goal, Record<Level, string[]>>;

const prompts: Record<Locale, PromptSet> = {
  es: {
    interview: {
      A2: ["What is one thing you are good at?", "What kind of work do you enjoy?", "How do you organize your day?"],
      B1: ["Tell me about a time you solved a difficult problem.", "What does your ideal team look like?", "How do you learn a new skill at work?"],
      B2: ["How do you make a decision when you have incomplete information?", "Describe a time you changed your mind after hearing another perspective.", "What would you improve about the way teams collaborate?"],
    },
    exam: {
      A2: ["What do you like to do on weekends?", "Do you prefer studying at home or in a library? Why?", "Describe a meal you enjoy."],
      B1: ["Do you think cities should limit private cars? Why or why not?", "What is one change that has improved people's lives?", "How can travel change a person's perspective?"],
      B2: ["Should schools teach more practical skills? Support your answer with an example.", "How should communities balance growth and the environment?", "Do social networks bring people closer together? Explain your view."],
    },
    everyday: {
      A2: ["What is your favorite place in your city?", "What did you do yesterday?", "What kind of music do you enjoy?"],
      B1: ["What is a small thing that made you happy this week?", "Describe a place where you feel at home.", "What skill would you like to learn next?"],
      B2: ["What is a habit you changed that made your life better?", "If you could spend a year anywhere, where would you go and why?", "What does a good work-life balance mean to you?"],
    },
  },
  en: {
    interview: {
      A2: ["What is one thing you are good at?", "What kind of work do you enjoy?", "How do you organize your day?"],
      B1: ["Tell me about a time you solved a difficult problem.", "What does your ideal team look like?", "How do you learn a new skill at work?"],
      B2: ["How do you make a decision when you have incomplete information?", "Describe a time you changed your mind after hearing another perspective.", "What would you improve about the way teams collaborate?"],
    },
    exam: {
      A2: ["What do you like to do on weekends?", "Do you prefer studying at home or in a library? Why?", "Describe a meal you enjoy."],
      B1: ["Do you think cities should limit private cars? Why or why not?", "What is one change that has improved people's lives?", "How can travel change a person's perspective?"],
      B2: ["Should schools teach more practical skills? Support your answer with an example.", "How should communities balance growth and the environment?", "Do social networks bring people closer together? Explain your view."],
    },
    everyday: {
      A2: ["What is your favorite place in your city?", "What did you do yesterday?", "What kind of music do you enjoy?"],
      B1: ["What is a small thing that made you happy this week?", "Describe a place where you feel at home.", "What skill would you like to learn next?"],
      B2: ["What is a habit you changed that made your life better?", "If you could spend a year anywhere, where would you go and why?", "What does a good work-life balance mean to you?"],
    },
  },
  pt: {
    interview: {
      A2: ["What is one thing you are good at?", "What kind of work do you enjoy?", "How do you organize your day?"],
      B1: ["Tell me about a time you solved a difficult problem.", "What does your ideal team look like?", "How do you learn a new skill at work?"],
      B2: ["How do you make a decision when you have incomplete information?", "Describe a time you changed your mind after hearing another perspective.", "What would you improve about the way teams collaborate?"],
    },
    exam: {
      A2: ["What do you like to do on weekends?", "Do you prefer studying at home or in a library? Why?", "Describe a meal you enjoy."],
      B1: ["Do you think cities should limit private cars? Why or why not?", "What is one change that has improved people's lives?", "How can travel change a person's perspective?"],
      B2: ["Should schools teach more practical skills? Support your answer with an example.", "How should communities balance growth and the environment?", "Do social networks bring people closer together? Explain your view."],
    },
    everyday: {
      A2: ["What is your favorite place in your city?", "What did you do yesterday?", "What kind of music do you enjoy?"],
      B1: ["What is a small thing that made you happy this week?", "Describe a place where you feel at home.", "What skill would you like to learn next?"],
      B2: ["What is a habit you changed that made your life better?", "If you could spend a year anywhere, where would you go and why?", "What does a good work-life balance mean to you?"],
    },
  },
};

export function getPrompt(locale: Locale, goal: Goal, level: Level, index: number): string {
  const list = prompts[locale][goal][level];
  return list[((index % list.length) + list.length) % list.length];
}
