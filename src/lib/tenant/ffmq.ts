/**
 * FFMQ — Five Facet Mindfulness Questionnaire (Ruth A. Baer, Ph.D., University of
 * Kentucky). Återgivet ORDAGRANT ur originalformuläret (FFMQ-eng.pdf) — Lisas beslut
 * 2026-07-31: instrumentet återges med källhänvisning, säljs inte. Ändra ALDRIG
 * lydelser — instrumentdrift förstör före/efter-jämförbarheten.
 *
 * Scoringen (vändning + facettsummor) bor i DB-funktionen submit_ffmq — EN sanning.
 * Här bor bara det som VISAS: items, skalan, facettnamn och attributionen.
 */

export const FFMQ_TITLE = "Five Facet Mindfulness Questionnaire (FFMQ)";
export const FFMQ_AUTHOR = "Ruth A. Baer, Ph.D., University of Kentucky";
export const FFMQ_AUTHOR_URL = "https://ruthbaer.com/academics/index.html";
export const FFMQ_SWEDISH_VERSION_URL =
  "https://www.lunduniversity.lu.se/publication/96f42e8f-d0ae-4b2e-b436-13b9e995fdeb";

export const FFMQ_INSTRUCTION =
  "Please rate each of the following statements using the scale provided. " +
  "Write the number in the blank that best describes your own opinion of what is generally true for you.";

export const FFMQ_SCALE: { value: number; label: string }[] = [
  { value: 1, label: "never or very rarely true" },
  { value: 2, label: "rarely true" },
  { value: 3, label: "sometimes true" },
  { value: 4, label: "often true" },
  { value: 5, label: "very often or always true" },
];

export const FFMQ_ITEMS: string[] = [
  "When I’m walking, I deliberately notice the sensations of my body moving.",
  "I’m good at finding words to describe my feelings.",
  "I criticize myself for having irrational or inappropriate emotions.",
  "I perceive my feelings and emotions without having to react to them.",
  "When I do things, my mind wanders off and I’m easily distracted.",
  "When I take a shower or bath, I stay alert to the sensations of water on my body.",
  "I can easily put my beliefs, opinions, and expectations into words.",
  "I don’t pay attention to what I’m doing because I’m daydreaming, worrying, or otherwise distracted.",
  "I watch my feelings without getting lost in them.",
  "I tell myself I shouldn’t be feeling the way I’m feeling.",
  "I notice how foods and drinks affect my thoughts, bodily sensations, and emotions.",
  "It’s hard for me to find the words to describe what I’m thinking.",
  "I am easily distracted.",
  "I believe some of my thoughts are abnormal or bad and I shouldn’t think that way.",
  "I pay attention to sensations, such as the wind in my hair or sun on my face.",
  "I have trouble thinking of the right words to express how I feel about things",
  "I make judgments about whether my thoughts are good or bad.",
  "I find it difficult to stay focused on what’s happening in the present.",
  "When I have distressing thoughts or images, I “step back” and am aware of the thought or image without getting taken over by it.",
  "I pay attention to sounds, such as clocks ticking, birds chirping, or cars passing.",
  "In difficult situations, I can pause without immediately reacting.",
  "When I have a sensation in my body, it’s difficult for me to describe it because I can’t find the right words.",
  "It seems I am “running on automatic” without much awareness of what I’m doing.",
  "When I have distressing thoughts or images, I feel calm soon after.",
  "I tell myself that I shouldn’t be thinking the way I’m thinking.",
  "I notice the smells and aromas of things.",
  "Even when I’m feeling terribly upset, I can find a way to put it into words.",
  "I rush through activities without being really attentive to them.",
  "When I have distressing thoughts or images I am able just to notice them without reacting.",
  "I think some of my emotions are bad or inappropriate and I shouldn’t feel them.",
  "I notice visual elements in art or nature, such as colors, shapes, textures, or patterns of light and shadow.",
  "My natural tendency is to put my experiences into words.",
  "When I have distressing thoughts or images, I just notice them and let them go.",
  "I do jobs or tasks automatically without being aware of what I’m doing.",
  "When I have distressing thoughts or images, I judge myself as good or bad, depending what the thought/image is about.",
  "I pay attention to how my emotions affect my thoughts and behavior.",
  "I can usually describe how I feel at the moment in considerable detail.",
  "I find myself doing things without paying attention.",
  "I disapprove of myself when I have irrational ideas.",
];

/** Facettnamnen ur scoringinstruktionen (instrumentets egna) + max per facett. */
export const FFMQ_FACETS: { key: string; label: string; max: number }[] = [
  { key: "observing", label: "Observing", max: 40 },
  { key: "describing", label: "Describing", max: 40 },
  { key: "acting_awareness", label: "Acting with awareness", max: 40 },
  { key: "nonjudging", label: "Nonjudging of inner experience", max: 40 },
  { key: "nonreactivity", label: "Nonreactivity to inner experience", max: 35 },
];
