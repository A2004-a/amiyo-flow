import React, { useState, useMemo } from 'react';
import {
  PenTool,
  Check,
  CheckCheck,
  Briefcase,
  Smile,
  GraduationCap,
  Terminal,
  Bot,
  FileText,
  Sparkles,
  VolumeX,
  Repeat,
  Wand2,
  Plus,
  X,
  Zap,
  RotateCcw,
  Tag,
  Clock,
  ShieldCheck,
  Mic,
  List,
  Mail,
} from 'lucide-react';
import { useSettingsStore } from '../stores/useSettingsStore';

interface StyleDefinition {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  exampleSpoken: string;
  exampleOutput: string;
}

function isInterrogativeSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  const words = trimmed.toLowerCase().split(/\s+/);
  if (words.length === 0) return false;
  const cleanFirst = words[0].replace(/[^a-z0-9]/g, '');

  const singleStarters = ['what', 'why', 'how', 'who', 'where', 'when', 'which', 'whose', 'whom'];
  if (singleStarters.includes(cleanFirst)) {
    if (words.length >= 2 && ['we', 'it', 'they', 'i'].includes(words[1])) {
      return false;
    }
    if (
      words.length >= 3 &&
      words[1] === 'you' &&
      words.slice(2).some((w) => ['is', 'was', 'are', 'were'].includes(w))
    ) {
      return false;
    }
    return true;
  }

  if (words.length >= 2) {
    const cleanSecond = words[1].replace(/[^a-z0-9]/g, '');
    const firstTwo = `${cleanFirst} ${cleanSecond}`;
    const auxStarters = [
      'can you', 'can we', 'can i', 'could you', 'could we', 'could i',
      'would you', 'would we', 'would it', 'would that', 'would this',
      'should we', 'should i', 'should you', 'should it',
      'is it', 'is there', 'is that', 'is this', 'is he', 'is she', 'is the',
      'are you', 'are we', 'are they', 'are there', 'are the',
      'do you', 'do we', 'do they', 'does it', 'does he', 'does she', 'does the',
      'did you', 'did we', 'did they', 'did it', 'did the',
      'will you', 'will we', 'will it', 'will that', 'will the',
      'have you', 'have we', 'have they', 'has it', 'has anyone', 'has someone', 'has the',
      'may i', 'may we', 'shall we', 'shall i',
    ];
    if (auxStarters.includes(firstTwo)) {
      return true;
    }
  }

  return false;
}

function isIncompleteSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  const words = trimmed.split(/\s+/);
  if (words.length === 0) return false;
  const lastWord = words[words.length - 1].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (!lastWord) return false;

  const incompleteConnectors = [
    'and', 'or', 'but', 'nor', 'yet', 'so',
    'because', 'although', 'though', 'since', 'unless', 'while', 'whereas',
    'if', 'whether', 'as', 'that', 'after', 'before', 'until', 'till', 'whenever', 'wherever',
    'to', 'for', 'with', 'of', 'in', 'on', 'at', 'by', 'from', 'into',
    'about', 'between', 'through', 'without', 'under', 'over', 'around', 'onto',
    'towards', 'toward', 'upon', 'within', 'amid', 'amidst', 'versus', 'vs',
    'regarding', 'concerning', 'via',
    'which', 'where', 'who', 'whom', 'whose', 'what', 'when', 'why', 'how',
    'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'our', 'their', 'its',
    'the', 'a', 'an', 'some', 'any', 'every', 'each', 'either', 'neither', 'all', 'both',
    'more', 'most', 'few', 'fewer', 'many', 'much',
    'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'ought',
    'is', 'are', 'was', 'were', 'am', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'want', 'wants', 'wanted', 'need', 'needs', 'needed', 'try', 'tries', 'tried', 'trying',
    'going', 'gonna', 'plan', 'planning', 'hope', 'hoping', 'mean', 'meant', 'means',
    'started', 'starting', 'begin', 'began',
    'like', 'including', 'then', 'also', 'plus', 'such', 'overall', 'well'
  ];

  return incompleteConnectors.includes(lastWord);
}

function applySpokenEditCommands(input: string): string {
  let text = input.trim();
  if (!text) return text;

  const cmdRe = /(?:[,.]\s*|\s+(?:and\s+)?)\b(?:change|replace)\s+(all\s+)?([a-zA-Z0-9$€£#]+(?:\s+[a-zA-Z0-9$€£#]+){0,2})\s+(?:to|with)\s+([a-zA-Z0-9$€£#]+(?:\s+[a-zA-Z0-9$€£#]+){0,2})[.?!]?$/i;

  const commands: { isAll: boolean; target: string; replacement: string }[] = [];
  while (true) {
    const match = text.match(cmdRe);
    if (!match || match.index === undefined) break;

    const isAll = Boolean(match[1]);
    const target = match[2].trim();
    const replacement = match[3].trim();
    commands.push({ isAll, target, replacement });
    text = text.slice(0, match.index).trim();
  }

  if (commands.length === 0) return input;

  commands.reverse();
  for (const { isAll, target, replacement } of commands) {
    if (!target) continue;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (isAll) {
      text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), replacement);
    } else {
      const re = new RegExp(`\\b${escaped}\\b`, 'gi');
      let lastMatch: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        lastMatch = m;
      }
      if (lastMatch && lastMatch.index !== undefined) {
        text = text.slice(0, lastMatch.index) + replacement + text.slice(lastMatch.index + lastMatch[0].length);
      }
    }
  }

  return text;
}

function resolvePivotBacktrack(before: string, replacement: string): string | null {
  const beforeTrimmed = before.trim();
  const replTrimmed = replacement.trim();
  if (!beforeTrimmed || !replTrimmed) return null;

  const beforeWords = beforeTrimmed.split(/\s+/);
  const replWords = replTrimmed.split(/\s+/);
  if (beforeWords.length === 0 || replWords.length === 0) return null;

  const maxLen = Math.min(3, replWords.length, beforeWords.length);
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'is', 'was', 'are', 'were', 'it', 'this', 'that', 'i', 'we', 'you', 'they',
    'he', 'she', 'no', 'not'
  ]);

  for (let pivotLen = maxLen; pivotLen >= 1; pivotLen--) {
    const pivotTokens = replWords.slice(0, pivotLen).map((w) => w.replace(/[^a-z0-9]/gi, '').toLowerCase());

    if (pivotLen === 1) {
      const token = pivotTokens[0];
      if (token.length < 4 || stopWords.has(token)) {
        continue;
      }
    }

    if (beforeWords.length >= pivotLen) {
      for (let i = beforeWords.length - pivotLen; i >= 0; i--) {
        const candidate = beforeWords.slice(i, i + pivotLen).map((w) => w.replace(/[^a-z0-9]/gi, '').toLowerCase());
        const matches = candidate.every((tok, idx) => tok === pivotTokens[idx]);
        if (matches) {
          const prefix = i > 0 ? beforeWords.slice(0, i).join(' ') + ' ' : '';
          if (replWords.length > pivotLen) {
            return `${prefix}${replTrimmed}`;
          } else {
            if (i + pivotLen < beforeWords.length) {
              const nextWord = beforeWords[i + pivotLen];
              const cleanNext = nextWord.replace(/[^a-z0-9]/gi, '').toLowerCase();
              const skipDigression = ['using', 'with', 'for', 'and', 'but', 'in', 'at', 'by', 'from'];
              if (!skipDigression.includes(cleanNext)) {
                return `${prefix}${replTrimmed} ${nextWord}`;
              }
            }
            return `${prefix}${replTrimmed}`;
          }
        }
      }
    }
  }

  return null;
}

function extractSpokenStyleCommand(input: string): { style: string | null; content: string } {
  const trimmed = input.trim();
  if (!trimmed) return { style: null, content: '' };

  const triggers: [RegExp, string][] = [
    [/^(?:please\s+)?(?:convert\s+(?:this\s+)?(?:in|into)\s+(?:a\s+)?proper\s+prompt|make\s+(?:this\s+)?a\s+prompt|create\s+a\s+proper\s+prompt\s+(?:for|from)?|generate\s+a\s+prompt\s+for|in\s+prompt\s+mode|as\s+a\s+prompt|using\s+prompt\s+style|in\s+prompt\s+style)\s*[:,\-]?\s*(.*)$/i, 'AI Prompt'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|using|switch\s+to|switch\s+style\s+to|set\s+style\s+to|change\s+to|convert\s+(?:this\s+)?to|make\s+this)?\s*business\s+style\s*[:,\-]?\s*(.*)$/i, 'Professional'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|using|switch\s+to|switch\s+style\s+to|set\s+style\s+to|change\s+to|convert\s+(?:this\s+)?to|make\s+this)?\s*professional\s+style\s*[:,\-]?\s*(.*)$/i, 'Professional'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|using|switch\s+to|switch\s+style\s+to|set\s+style\s+to|change\s+to|convert\s+(?:this\s+)?to|make\s+this)?\s*casual\s+style\s*[:,\-]?\s*(.*)$/i, 'Casual'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|using|switch\s+to|switch\s+style\s+to|set\s+style\s+to|change\s+to|convert\s+(?:this\s+)?to|make\s+this)?\s*developer\s+style\s*[:,\-]?\s*(.*)$/i, 'Developer'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|using|switch\s+to|switch\s+style\s+to|set\s+style\s+to|change\s+to|convert\s+(?:this\s+)?to|make\s+this)?\s*academic\s+style\s*[:,\-]?\s*(.*)$/i, 'Academic'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|as|using)\s+bullet\s+points?\s*[:,\-]?\s*(.*)$/i, 'Bullet Points'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|as|using)\s+(?:an?\s+)?email\s*[:,\-]?\s*(.*)$/i, 'Email'],
    [/^(?:please\s+)?(?:write\s+this\s+)?(?:in|using)\s+raw\s+mode\s*[:,\-]?\s*(.*)$/i, 'Raw'],
  ];

  for (const [re, styleName] of triggers) {
    const match = trimmed.match(re);
    if (match) {
      return { style: styleName, content: (match[1] || '').trim() };
    }
  }

  return { style: null, content: trimmed };
}

function transformToBusinessStyle(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  let res = trimmed;

  res = res.replace(
    /\b(?:can\s+we\s+maybe|maybe\s+we\s+can|could\s+we\s+maybe)\s+(?:move|reschedule)\s+the\s+meeting\s+to\s+([0-9:]+\s*(?:AM|PM|today|tomorrow)?)\s*(?:if\s+that\s+works\s+for\s+you)?\b/gi,
    'Would it be possible to reschedule our meeting to $1? Please let me know if that works for your schedule.'
  );
  res = res.replace(
    /\b(?:can\s+we\s+maybe|maybe\s+we\s+can|could\s+we\s+maybe)\s+(?:move|reschedule)\s+the\s+meeting\s+to\s+([a-zA-Z0-9:]+)\s*(?:if\s+that\s+works\s+for\s+you)?\b/gi,
    'Would it be possible to reschedule our meeting to $1? Please let me know if that works for your schedule.'
  );

  const replacements: [RegExp, string][] = [
    [/\bcan\s+we\s+maybe\b/gi, 'Could we please'],
    [/\bi\s+was\s+just\s+checking\s+if\b/gi, 'I am writing to inquire whether'],
    [/\bi\s+was\s+wondering\s+if\b/gi, 'I would like to inquire whether'],
    [/\blet\s+me\s+know\s+what\s+you\s+think\b/gi, 'I would appreciate your feedback and insights on this matter.'],
    [/\bthanks\s+a\s+lot\b/gi, 'Thank you very much for your time and consideration.'],
    [/\bgonna\b/gi, 'going to'],
    [/\bwanna\b/gi, 'would like to'],
    [/\bgotta\b/gi, 'need to'],
    [/\basap\b/gi, 'at your earliest convenience'],
    [/\byeah\s+basically\b/gi, 'Indeed,'],
    [/\bhey\s+guys\b/gi, 'Dear colleagues,'],
    [/\btotally\s+push\b/gi, 'proceed with deploying'],
  ];

  for (const [re, repl] of replacements) {
    res = res.replace(re, repl);
  }

  res = res.trim();
  if (res && !/[.!?]$/.test(res)) {
    res += '.';
  }

  return res.charAt(0).toUpperCase() + res.slice(1);
}

function engineerStructuredPrompt(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  if (trimmed.toLowerCase().startsWith('act as') || trimmed.toLowerCase().startsWith('you are an expert')) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  let role = 'an expert consultant and domain specialist';
  if (
    lower.includes('code') ||
    lower.includes('build') ||
    lower.includes('app') ||
    lower.includes('function') ||
    lower.includes('program') ||
    lower.includes('api') ||
    lower.includes('interface') ||
    lower.includes('rust') ||
    lower.includes('python') ||
    lower.includes('react') ||
    lower.includes('tauri') ||
    lower.includes('software')
  ) {
    role = 'an expert software architect and full-stack engineer';
  } else if (
    lower.includes('write') ||
    lower.includes('article') ||
    lower.includes('blog') ||
    lower.includes('essay') ||
    lower.includes('email')
  ) {
    role = 'a master copywriter and communications specialist';
  } else if (
    lower.includes('analyze') ||
    lower.includes('data') ||
    lower.includes('sql') ||
    lower.includes('metrics')
  ) {
    role = 'a senior data analyst and systems architect';
  }

  const task = trimmed.replace(/\.+$/, '');
  return `Act as ${role}.\n\nObjective: ${task}.\n\nKey Requirements:\n- Detail step-by-step strategy and architectural breakdown.\n- Provide concrete, production-ready examples and address edge cases.\n- Highlight best practices, pitfalls to avoid, and verification guidelines.\n\nPlease structure the response with clear headings and bulleted explanations.`;
}

function transformToBulletPoints(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const parts = trimmed
    .split(/(?:\.\s+|\;\s+|\n+|,\s*(?:and\s+also|and|also|plus)\s+)/i)
    .map((s) => s.trim().replace(/^[,.\s-]+|[,.\s-]+$/g, ''))
    .filter(Boolean);

  if (parts.length <= 1) {
    const andParts = trimmed
      .split(/\s+and\s+/i)
      .map((s) => s.trim().replace(/^[,.\s-]+|[,.\s-]+$/g, ''))
      .filter(Boolean);
    if (andParts.length > 1) {
      return andParts.map((item) => `- ${item.charAt(0).toUpperCase() + item.slice(1)}`).join('\n');
    }
    return `- ${trimmed}`;
  }

  return parts.map((item) => `- ${item.charAt(0).toUpperCase() + item.slice(1)}`).join('\n');
}

function transformToEmailFormat(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);
  const subjectWords = words.length > 6 ? words.slice(0, 6).join(' ') : trimmed;
  const cleanSubject = subjectWords.replace(/[^a-zA-Z0-9 ]/g, '').trim();

  return `Subject: ${cleanSubject}\n\nHi team,\n\n${trimmed}\n\nBest regards,\nAmiyo Garai`;
}

function simulateCleanup(
  input: string,
  removeFillers: boolean,
  removeRepeats: boolean,
  removeCorrections: boolean,
  cleanSentences: boolean,
  customFillers: string[]
): string {
  if (!input.trim()) return '';

  // Step 0: Voice Command Directive Extraction
  const { style: spokenStyle, content } = extractSpokenStyleCommand(input);
  let text = spokenStyle ? content : input;
  if (!text.trim()) return '';

  if (spokenStyle === 'Raw') {
    return text;
  }

  // -1. Mid-sentence regreeting restart stripper
  const restartMatch = text.match(
    /^.*?\b(?:and\s+I\s+try\s+to|and\s+I\s+want\s+to|and\s+I|so\s+I|but\s+I|and\s+then|then|wait|no\s+wait)\s+((?:hey|hi|hello|welcome)\b.*)$/i
  );
  if (restartMatch && restartMatch[1]) {
    text = restartMatch[1].trim();
  }

  // 0. Spoken in-line editing commands ("change Friday to Saturday", "change all 2 to 4")
  text = applySpokenEditCommands(text);

  // 0a. Pre-greeting cleaner: strips throat clearing, coughs, warmup stutters before assistant greetings
  const preGreetingMatch = text.match(
    /^(?:\s*[,.]*\s*(?:een|aam|ehn|uhn|ehm|um|uh|nu|na|erm|ah|aa|aah|ahh|amiyo|omiya|omiyaya|omiyo|omi|testing|mic|hello|hi|one\s+two|one\s+two\s+three)+\s*[,.]*)+\s*(?:omi)?\s*(hey\s+claude|hi\s+claude|hello\s+claude|claude|hey\s+opencode|hi\s+opencode|hello\s+opencode|opencode|hey\s+open\s+code|open\s+code|hey\s+chatgpt|hi\s+chatgpt|hello\s+chatgpt|chatgpt)\b/i
  );
  if (preGreetingMatch && preGreetingMatch[1]) {
    const greeting = preGreetingMatch[1];
    const fullLen = preGreetingMatch[0].length;
    text = `${greeting}${text.slice(fullLen)}`;
  }

  // 0b. Pre-normalize compound developer terms and acoustic homophones before filler stripping
  const preHomophones: [RegExp, string][] = [
    [/\b(?:hey\s+)?open\s+port\b/gi, 'Hey OpenCode'],
    [/\bopen\s+port\b/gi, 'OpenCode'],
    [/\bopen\s+code\b/gi, 'OpenCode'],
    [/\bopen-code\b/gi, 'OpenCode'],
    [/\b(?:hey\s+)?open\s+(?:cord|court|cot|coat|cold|card)\b/gi, 'Hey OpenCode'],
    [/\bhey\s*,\s*welcome\s+claude\b/gi, 'Hey OpenCode'],
    [/\bwelcome\s+claude\b/gi, 'OpenCode'],
    [/\bhey\s*,\s*i'm\s+claude\b/gi, 'Hey OpenCode'],
    [/\bhey\s+i'm\s+claude\b/gi, 'Hey OpenCode'],
    [/\bi'm\s+claude\s*,\s*my\s+name\s+is\b/gi, 'Hey OpenCode, my name is'],
    [/\bopencode\b/gi, 'OpenCode'],
    [/\bi'm\s+a\s+child\s+of\s+built-in\s+system\b/gi, 'I try to build a system'],
    [/\ba\s+child\s+of\s+built-in\s+system\b/gi, 'built-in system'],
    [/\bchild\s+of\s+built\b/gi, 'build'],
    [/\b(?:k-a-b-o|k\s+a\s+b\s+o|kabo|kaybo)\s+interface\b/gi, 'keyboard interface'],
    [/\b(?:k-a-b-o|k\s+a\s+b\s+o)\b/gi, 'keyboard'],
    [/\b(?:what|which)\s+talks\s+we've\s+done\b/gi, "what tasks we've done"],
    [/\btalks\s+we've\s+done\b/gi, "tasks we've done"],
    [/\bwhat\s+each\s+other\s+works\b/gi, 'how each works'],
    [/\bwrite\s+the\s+tags\s+and\s+anything\b/gi, 'write the text and anything'],
    [/\bwrite\s+the\s+tags\b/gi, 'write the text'],
    [/\ba\s+word-like\s+app\b/gi, 'a Word-like app'],
    [/\bword-like\s+app\b/gi, 'Word-like app'],
    [/\bword\s+like\s+app\b/gi, 'Word-like app'],
    [/\bdock\s+er\b/gi, 'Docker'],
    [/\b(?:next\s+js|nextjs)\b/gi, 'Next.js'],
    [/\b(?:node\s+js|nodejs)\b/gi, 'Node.js'],
    [/\b(?:react\s+js|reactjs)\b/gi, 'React'],
    [/\bgit\s+hub\b/gi, 'GitHub'],
    [/\byou\s+tube\b/gi, 'YouTube'],
    [/\b(?:pie\s+thon|py\s+thon)\b/gi, 'Python'],
    [/\bpool\s+requests?\b/gi, 'pull request'],
    [/\bfront\s+end\b/gi, 'frontend'],
    [/\bback\s+end\b/gi, 'backend'],
    [/\bfull\s+stack\b/gi, 'full-stack'],
    [/\bopen\s+source\b/gi, 'open-source'],
    [/\bmicro\s+soft\b/gi, 'Microsoft'],
    [/\bpower\s+point\b/gi, 'PowerPoint'],
    [/\b(?:ex\s+cel|ex\s+cell)\b/gi, 'Excel'],
    [/\bout\s+look\b/gi, 'Outlook'],
    [/\bhow\s+(?:the\s+)?what's\s+up\s+works\b/gi, 'how WhatsApp works'],
    [/\b(?:the\s+)?what's\s+up\s+works\b/gi, 'WhatsApp works'],
    [/\bwhat's\s+up\s+and\s+creative\b/gi, 'WhatsApp and creative'],
    [/\bwhat's\s+up\b(?=.*(?:user\s+manual|chatgpt|claude|windows|app|software|features|message|messaging|chat))/gi, 'WhatsApp'],
    [/\bwhat's\s+up\s+(?:web|app|group|chat|call|status)\b/gi, 'WhatsApp $1'],
    [/\bmicrosoft\s+osu\s+system\b/gi, 'Microsoft Office system'],
    [/\bmicrosoft\s+osu\b/gi, 'Microsoft Office'],
    [/\bosu\s+system\b/gi, 'Office system'],
    [/\btake\s+claude\b/gi, 'Hey Claude'],
    [/\bomi\s*hey\s+claude\b/gi, 'Hey Claude'],
    [/\bomi\s*claude\b/gi, 'Claude'],
    [/\blike\s+a\s+mail\s*,\s*like\s+win\b/gi, 'like Mail, like Word'],
    [/\blike\s+mail\s*,\s*like\s+win\b/gi, 'like Mail, like Word'],
    [/\blike\s+a\s+mail\s*,\s*like\s+word\b/gi, 'like Mail, like Word'],
    [/\blike\s+win\s*,\s*what\s+else\s+is\s+there\b/gi, 'like Word, what else is there'],
    [/\blike\s+win\b(?=.*(?:powerpoint|excel|office|microsoft))/gi, 'like Word'],
    [/\bby\s+windows\s+11\b/gi, 'for Windows 11'],
  ];
  for (const [re, repl] of preHomophones) {
    text = text.replace(re, repl);
  }

  // 1. Spoken self corrections
  if (removeCorrections) {
    for (let iter = 0; iter < 5; iter++) {
      const clauseMatch = text.match(
        /(?:^|[.!?\n]\s*)(?:.+?)[,\s]+(wait let me start over|let me start over|start over|scratch all that|actually what I meant was|correction please|I mean to say|no no wait|no no no|no no|no wait|scratch that last word|scratch that|sorry scratch that|sorry I meant|actually no|wait no|no sorry|sorry no|oops I meant|or rather|rather|make that|whoops|my bad|wait let me rephrase|replace that with|cancel that|disregard that|correction|let me rephrase|strike that|I mean)[,\s]+(.+)/i
      );
      if (clauseMatch && clauseMatch[2]) {
        const trigger = (clauseMatch[1] || '').toLowerCase();
        const repl = clauseMatch[2].trim();
        const matchIndex = clauseMatch.index ?? 0;
        const before = text.slice(0, matchIndex).trim();

        const isFullRestart = trigger.includes("start over")
          || trigger.includes("scratch all that")
          || trigger.includes("delete all that")
          || trigger.includes("clear that");

        if (isFullRestart) {
          text = repl;
        } else {
          const pivotResolved = resolvePivotBacktrack(before, repl);
          if (pivotResolved) {
            text = pivotResolved;
          } else {
            text = repl;
          }
        }
      } else {
        const bareNoMatch = text.match(/(?:,\s*no[,\s]+|\s+no[,\s]+)(.+)/i);
        if (bareNoMatch && bareNoMatch[1] && bareNoMatch.index !== undefined) {
          const repl = bareNoMatch[1].trim();
          const before = text.slice(0, bareNoMatch.index).trim();
          const pivotResolved = resolvePivotBacktrack(before, repl);
          if (pivotResolved) {
            text = pivotResolved;
          } else {
            break;
          }
        } else {
          break;
        }
      }
    }
  }

  // 2. Filler words
  if (removeFillers) {
    // Search-for-words, phrasing & hesitation queries
    text = text.replace(/\b(?:what\s+else\s+is\s+there\s*,\s*like\s+what|what\s+else\s+is\s+there|like\s+what\s+is\s+there)\b,?/gi, '');
    text = text.replace(/\b(?:what\s+I\s+mean\s+to\s+say|what\s+I'm\s+saying\s+is|what\s+I\s+meant\s+to\s+say|what\s+I\s+wanted\s+to\s+say|I\s+was\s+gonna\s+say)\b,?/gi, '');
    text = text.replace(/\b(?:how\s+do\s+you\s+say|how\s+can\s+I\s+say|how\s+to\s+say|how\s+should\s+I\s+put\s+it|what\s+do\s+you\s+call\s+it|what\s+is\s+it\s+called|what's\s+it\s+called|what\s+was\s+it\s+called|what\s+was\s+it)\b,?/gi, '');
    text = text.replace(/\b(?:if\s+you\s+get\s+what\s+I\s+mean|if\s+you\s+know\s+what\s+I\s+mean)\b,?/gi, '');
    text = text.replace(/\b(?:at\s+the\s+end\s+of\s+the\s+day|more\s+or\s+less|for\s+what\s+it's\s+worth|what\s+was\s+I\s+saying|where\s+was\s+I)\b,?/gi, '');
    // Pause & thinking hesitations
    text = text.replace(/\b(?:let's\s+see|let\s+me\s+see|let\s+me\s+think|lemme\s+see)\b,?/gi, '');
    text = text.replace(/\b(?:give\s+me\s+a\s+second|give\s+me\s+a\s+sec|give\s+me\s+a\s+minute|give\s+me\s+a\s+moment|just\s+a\s+second|just\s+a\s+moment|just\s+a\s+sec|one\s+second|one\s+sec|one\s+moment)\b,?/gi, '');
    text = text.replace(/\b(?:wait\s+a\s+minute|wait\s+a\s+second|wait\s+a\s+sec|wait\s+wait\s+wait|wait\s+wait|hold\s+on\s+a\s+second|hold\s+on\s+a\s+sec|hold\s+on)\b,?/gi, '');
    // Vagueness tails & trailing fillers
    text = text.replace(/\b(?:and\s+things\s+like\s+that|and\s+that\s+sort\s+of\s+thing|and\s+so\s+on\s+and\s+so\s+forth|and\s+so\s+on|and\s+stuff\s+like\s+that|and\s+all\s+that\s+stuff|and\s+all\s+of\s+that|and\s+all\s+that|or\s+something\s+like\s+that|or\s+something|or\s+whatever\s+it\s+is|or\s+whatever)\b,?/gi, '');
    text = text.replace(/\bload\s*,?\s*plug\s*,?\s*closely\b,?/gi, '');
    text = text.replace(/\b(?:no no wait|no no no|no no)\b,?/gi, '');
    // Regional slang particles & vocal throat clears
    text = text.replace(/\b(?:bhai|accha|matlab|na\s+re|arrey|arre\s+yaar|arre|yaar|toh\s+phir|toh|ki\s+na|mane)\b,?/gi, '');
    text = text.replace(/\b(?:ahem|uh-huh|mhm)\b,?/gi, '');
    // Hesitation syllables & combined stutter tokens
    text = text.replace(/\b(?:um\s+aa|aa\s+um|um\s+uh|uh\s+um|er\s+um|um\s+er|aa\s+nu|nu\s+aa|nu\s+na|na\s+nu|nu\s+nu|na\s+na)\b,?/gi, '');
    text = text.replace(/\b(?:een|aam|ehm|ehn|uhn|omiyaya)\b,?/gi, '');
    text = text.replace(/\b(um+|uh+|erm+|ah+|aa+|aah+|ahh+|nu+|na+|umm+|uhh+|er+|hmm+|uhm+|em+|ohh+|ooh+|huh+|heh+)\b,?/gi, '');
    // Common conversational fillers
    text = text.replace(/\b(?:and\s+)?I'm\s+like\b,?/gi, '');
    text = text.replace(/\b(?:and\s+)?I\s+was\s+like\b,?/gi, '');
    text = text.replace(/\b(you know what I mean|you know what I'm saying|you know|basically|actually|literally|sort of|kind of|so yeah|like I mean|to be honest|honestly speaking)\b,?/gi, '');
    for (const cf of customFillers) {
      const trimmed = cf.trim();
      if (trimmed) {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        text = text.replace(new RegExp(`\\b${escaped}\\b,?`, 'gi'), '');
      }
    }
  }

  // 3. Repeated stutters
  if (removeRepeats) {
    // Syllable stutters ("w- we can" -> "we can", "th- the" -> "the", "I- I" -> "I")
    text = text.replace(/\b([a-zA-Z]{1,3})[-—]\s*(\1[a-zA-Z]*)\b/gi, '$2');
    // 4-word phrase repeat (strip trailing pause comma)
    text = text.replace(/\b([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+),?\s+\1\s+\2\s+\3\s+\4\b/gi, '$1 $2 $3 $4');
    // 3-word phrase repeat (strip trailing pause comma)
    text = text.replace(/\b([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+),?\s+\1\s+\2\s+\3\b/gi, '$1 $2 $3');
    // 2-word phrase repeat (strip trailing pause comma)
    text = text.replace(/\b([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+),?\s+\1\s+\2\b/gi, '$1 $2');
    // single word repeat (strip trailing pause comma)
    text = text.replace(/\b([a-zA-Z0-9]+),?\s+\1\b/gi, '$1');
  }

  // 4. Verbal punctuation, numbers, percentages, currency, quotes
  text = text
    .replace(/\s+period\b/gi, '.')
    .replace(/\s+full stop\b/gi, '.')
    .replace(/\s+comma\b/gi, ',')
    .replace(/\s+question mark\b/gi, '?')
    .replace(/\s+(?:exclamation mark|exclamation point)\b/gi, '!')
    .replace(/\s+colon\b/gi, ':')
    .replace(/\s+semicolon\b/gi, ';')
    .replace(/\s+(?:new line|newline)\b/gi, '\n')
    // Spoken written percentages & numbers
    .replace(/\b(?:one hundred|hundred)\s+percent\b/gi, '100%')
    .replace(/\bninety\s+percent\b/gi, '90%')
    .replace(/\beighty\s+percent\b/gi, '80%')
    .replace(/\bseventy\s+percent\b/gi, '70%')
    .replace(/\bsixty\s+percent\b/gi, '60%')
    .replace(/\bfifty\s+percent\b/gi, '50%')
    .replace(/\bforty\s+percent\b/gi, '40%')
    .replace(/\bthirty\s+percent\b/gi, '30%')
    .replace(/\btwenty\s+five\s+percent\b/gi, '25%')
    .replace(/\btwenty\s+percent\b/gi, '20%')
    .replace(/\bfifteen\s+percent\b/gi, '15%')
    .replace(/\bten\s+percent\b/gi, '10%')
    .replace(/\bfive\s+percent\b/gi, '5%')
    .replace(/\bzero\s+percent\b/gi, '0%')
    .replace(/\b([0-9]+)\s+percent\b/gi, '$1%')
    // Spoken written currency
    .replace(/\b(?:one hundred|hundred)\s+dollars?\b/gi, '$$100')
    .replace(/\bfifty\s+dollars?\b/gi, '$$50')
    .replace(/\btwenty\s+dollars?\b/gi, '$$20')
    .replace(/\bten\s+dollars?\b/gi, '$$10')
    .replace(/\bfive\s+dollars?\b/gi, '$$5')
    .replace(/\bone\s+dollar\b/gi, '$$1')
    .replace(/\b([0-9]+)\s+dollars?\b/gi, '$$$1')
    .replace(/\b([0-9]+)\s+euros?\b/gi, '€$1')
    .replace(/\b([0-9]+)\s+pounds?\b/gi, '£$1')
    // Spoken numbers (#1, #5, etc.)
    .replace(/\bnumber\s+([0-9]+)\b/gi, '#$1')
    .replace(/\bnumber\s+one\b/gi, '#1')
    .replace(/\bnumber\s+two\b/gi, '#2')
    .replace(/\bnumber\s+three\b/gi, '#3')
    .replace(/\bnumber\s+four\b/gi, '#4')
    .replace(/\bnumber\s+five\b/gi, '#5')
    // Spoken step, part, option, and item numbering
    .replace(/\bstep\s+([0-9]+)\b/gi, 'Step $1')
    .replace(/\bstep\s+one\b/gi, 'Step 1')
    .replace(/\bstep\s+two\b/gi, 'Step 2')
    .replace(/\bstep\s+three\b/gi, 'Step 3')
    .replace(/\bstep\s+four\b/gi, 'Step 4')
    .replace(/\bstep\s+five\b/gi, 'Step 5')
    .replace(/\bpart\s+([0-9]+)\b/gi, 'Part $1')
    .replace(/\bpart\s+one\b/gi, 'Part 1')
    .replace(/\bpart\s+two\b/gi, 'Part 2')
    .replace(/\bpart\s+three\b/gi, 'Part 3')
    .replace(/\boption\s+([0-9]+)\b/gi, 'Option $1')
    .replace(/\boption\s+one\b/gi, 'Option 1')
    .replace(/\boption\s+two\b/gi, 'Option 2')
    .replace(/\bitem\s+([0-9]+)\b/gi, 'Item $1')
    .replace(/\bitem\s+one\b/gi, 'Item 1')
    .replace(/\bitem\s+two\b/gi, 'Item 2')
    // Spoken time formatting
    .replace(/\b(?:twelve|12)\s+thirty\s+(AM|PM)\b/gi, '12:30 $1')
    .replace(/\b(?:eleven|11)\s+thirty\s+(AM|PM)\b/gi, '11:30 $1')
    .replace(/\b(?:ten|10)\s+thirty\s+(AM|PM)\b/gi, '10:30 $1')
    .replace(/\b(?:nine|9)\s+thirty\s+(AM|PM)\b/gi, '9:30 $1')
    .replace(/\b(?:eight|8)\s+thirty\s+(AM|PM)\b/gi, '8:30 $1')
    .replace(/\b(?:seven|7)\s+thirty\s+(AM|PM)\b/gi, '7:30 $1')
    .replace(/\b(?:six|6)\s+thirty\s+(AM|PM)\b/gi, '6:30 $1')
    .replace(/\b(?:five|5)\s+thirty\s+(AM|PM)\b/gi, '5:30 $1')
    .replace(/\b(?:four|4)\s+thirty\s+(AM|PM)\b/gi, '4:30 $1')
    .replace(/\b(?:three|3)\s+thirty\s+(AM|PM)\b/gi, '3:30 $1')
    .replace(/\b(?:two|2)\s+thirty\s+(AM|PM)\b/gi, '2:30 $1')
    .replace(/\b(?:one|1)\s+thirty\s+(AM|PM)\b/gi, '1:30 $1')
    .replace(/\btwelve\s+(AM|PM)\b/gi, '12 $1')
    .replace(/\beleven\s+(AM|PM)\b/gi, '11 $1')
    .replace(/\bten\s+(AM|PM)\b/gi, '10 $1')
    .replace(/\bnine\s+(AM|PM)\b/gi, '9 $1')
    .replace(/\beight\s+(AM|PM)\b/gi, '8 $1')
    .replace(/\bseven\s+(AM|PM)\b/gi, '7 $1')
    .replace(/\bsix\s+(AM|PM)\b/gi, '6 $1')
    .replace(/\bfive\s+(AM|PM)\b/gi, '5 $1')
    .replace(/\bfour\s+(AM|PM)\b/gi, '4 $1')
    .replace(/\bthree\s+(AM|PM)\b/gi, '3 $1')
    .replace(/\btwo\s+(AM|PM)\b/gi, '2 $1')
    .replace(/\bone\s+(AM|PM)\b/gi, '1 $1')
    .replace(/\b([0-9]+)\s+o'?clock\b/gi, '$1:00')
    // Spoken large numbers
    .replace(/\b(?:one|1)\s+thousand\b/gi, '1,000')
    .replace(/\b(?:two|2)\s+thousand\b/gi, '2,000')
    .replace(/\b(?:five|5)\s+thousand\b/gi, '5,000')
    .replace(/\b(?:ten|10)\s+thousand\b/gi, '10,000')
    .replace(/\b(?:one|1)\s+million\b/gi, '1 million')
    .replace(/\b(?:two|2)\s+million\b/gi, '2 million')
    // Spoken math operations
    .replace(/\b([0-9]+)\s+plus\s+([0-9]+)\b/gi, '$1 + $2')
    .replace(/\b([0-9]+)\s+minus\s+([0-9]+)\b/gi, '$1 - $2')
    .replace(/\b([0-9]+)\s+equals\s+([0-9]+)\b/gi, '$1 = $2')
    // Spoken quotes & brackets
    .replace(/\bopen\s+quotes?\s+(.+?)\s+close\s+quotes?\b/gi, '"$1"')
    .replace(/\bopen\s+paren(?:thesis)?\s+(.+?)\s+close\s+paren(?:thesis)?\b/gi, '($1)')
    .replace(/\bopen\s+bracket\s+(.+?)\s+close\s+bracket\b/gi, '[$1]');

  // Clean duplicate commas and comma-period
  text = text.replace(/,\s*,+/g, ',').replace(/,\s*\./g, '.');

  // Clean up pause commas immediately following conjunctions (e.g. "and, we can" -> "and we can")
  text = text.replace(/\b(and|but|so|or),\s+([a-zA-Z])/gi, '$1 $2');

  // Clean up pause commas around conjunctions (e.g. ", and," -> ", and")
  text = text.replace(/,\s*(and|or|but|so)\s*,/gi, ', $1');

  // Spaces before punctuation
  text = text.replace(/\s+([,\.?!;:])/g, '$1');

  // 5. Smart Sentence & Grammar Polish
  if (cleanSentences) {
    // Fix lowercase pronoun 'i' and its contractions
    text = text
      .replace(/\b(i)\b/g, 'I')
      .replace(/\b(i'm|im)\b/gi, "I'm")
      .replace(/\b(i've|ive)\b/gi, "I've")
      .replace(/\b(i'll)\b/gi, "I'll")
      .replace(/\b(i'd)\b/gi, "I'd");

    // Fix common spoken contractions missing apostrophes
    const contractions: [RegExp, string][] = [
      [/\bdont\b/gi, "don't"],
      [/\bcant\b/gi, "can't"],
      [/\bwont\b/gi, "won't"],
      [/\bdidnt\b/gi, "didn't"],
      [/\bisnt\b/gi, "isn't"],
      [/\barent\b/gi, "aren't"],
      [/\bhasnt\b/gi, "hasn't"],
      [/\bhavent\b/gi, "haven't"],
      [/\bcouldnt\b/gi, "couldn't"],
      [/\bshouldnt\b/gi, "shouldn't"],
      [/\bwouldnt\b/gi, "wouldn't"],
      [/\b(?:couldntve|couldn't've)\b/gi, "couldn't have"],
      [/\b(?:shouldntve|shouldn't've)\b/gi, "shouldn't have"],
      [/\b(?:wouldntve|wouldn't've)\b/gi, "wouldn't have"],
      [/\bthats\b/gi, "that's"],
      [/\bwhats\b/gi, "what's"],
      [/\btheres\b/gi, "there's"],
      [/\bheres\b/gi, "here's"],
      [/\blets\b/gi, "let's"],
      [/\byoure\b/gi, "you're"],
      [/\btheyre\b/gi, "they're"],
      [/\bweve\b/gi, "we've"],
      [/\bwerent\b/gi, "weren't"],
      [/\bdoesnt\b/gi, "doesn't"],
      [/\bcouldve\b/gi, "could've"],
      [/\bshouldve\b/gi, "should've"],
      [/\bwouldve\b/gi, "would've"],
      [/\bmustve\b/gi, "must've"],
      [/\bmightve\b/gi, "might've"],
      [/\bwasnt\b/gi, "wasn't"],
      [/\bhadnt\b/gi, "hadn't"],
      [/\baint\b/gi, "ain't"],
      [/\byoull\b/gi, "you'll"],
      [/\btheyll\b/gi, "they'll"],
      [/\bshell\b/gi, "she'll"],
      [/\byoud\b/gi, "you'd"],
      [/\btheyd\b/gi, "they'd"],
      [/\bhed\b/gi, "he'd"],
      [/\bshed\b/gi, "she'd"],
      [/\bwhove\b/gi, "who've"],
      [/\bwheres\b/gi, "where's"],
      [/\bhows\b/gi, "how's"],
      [/\bwhatre\b/gi, "what're"],
      [/\bthered\b/gi, "there'd"],
      [/\bsomeones\b/gi, "someone's"],
      [/\beveryones\b/gi, "everyone's"],
      [/\bnobodys\b/gi, "nobody's"],
      [/\banyones\b/gi, "anyone's"],
      [/\balot\b/gi, "a lot"],
      [/\beachother\b/gi, "each other"],
      [/\baswell\b/gi, "as well"],
      [/\binfront\b/gi, "in front"],
      [/\bnevermind\b/gi, "never mind"],
      [/\bsaterday\b/gi, "Saturday"],
      [/\bwensday\b/gi, "Wednesday"],
      [/\bthrusday\b/gi, "Thursday"],
      [/\bhowd\b/gi, "how'd"],
      [/\bwhyd\b/gi, "why'd"],
      [/\bwhered\b/gi, "where'd"],
      [/\bwhatd\b/gi, "what'd"],
      [/\bwhod\b/gi, "who'd"],
      [/\bwholl\b/gi, "who'll"],
      [/\bwhatll\b/gi, "what'll"],
      [/\bthatll\b/gi, "that'll"],
      [/\bhowll\b/gi, "how'll"],
      [/\bitll\b/gi, "it'll"],
      [/\bcmon\b/gi, "c'mon"],
      // Developer & Tech Normalization
      [/\bchatgpt\s+like\s+interface\b/gi, "ChatGPT-like interface"],
      [/\bchatgpt\s+like\b/gi, "ChatGPT-like"],
      [/\bchargey\s+video\s+like\s+interface\b/gi, "ChatGPT-like interface"],
      [/\bchargey\s+video\b/gi, "ChatGPT"],
      [/\bchargey\s+bt\b/gi, "ChatGPT"],
      [/\bchargey\b/gi, "ChatGPT"],
      [/\bchat\s+gbt\b/gi, "ChatGPT"],
      [/\bchat\s+g\s+p\s+t\b/gi, "ChatGPT"],
      [/\bchat\s+g\s+p\b/gi, "ChatGPT"],
      [/\bchat\s+jpt\b/gi, "ChatGPT"],
      [/\bchat\s+j\s+p\s+t\b/gi, "ChatGPT"],
      [/\bcheck\s+gpt\b/gi, "ChatGPT"],
      [/\bcheckgpt\b/gi, "ChatGPT"],
      [/\bchot\s+gpt\b/gi, "ChatGPT"],
      [/\bchotgpt\b/gi, "ChatGPT"],
      [/\bchatt\s+gpt\b/gi, "ChatGPT"],
      [/\bset\s+gpt\b/gi, "ChatGPT"],
      [/\bsaid\s+gpt\b/gi, "ChatGPT"],
      [/\bshatgpt\b/gi, "ChatGPT"],
      [/\bshat\s+gpt\b/gi, "ChatGPT"],
      [/\bc\s+g\s+p\s+t\b/gi, "ChatGPT"],
      [/\bcgpt\b/gi, "ChatGPT"],
      // Acoustic Homophones for "and ChatGPT" / "friends and ChatGPT"
      [/\bhello\s+friends,\s*chatgpt\b/gi, "Hello friends and ChatGPT"],
      [/\bhello\s+friend,\s*chatgpt\b/gi, "Hello friend and ChatGPT"],
      [/\bhello\s+friends\s+and\s+chatgpt\b/gi, "Hello friends and ChatGPT"],
      [/\bhello\s+friend\s+and\s+chatgpt\b/gi, "Hello friend and ChatGPT"],
      [/\bfriends,\s*cellocegivity\b/gi, "friends and ChatGPT"],
      [/\bfriend,\s*cellocegivity\b/gi, "friend and ChatGPT"],
      [/\bfriends\s+and\s+cellocegivity\b/gi, "friends and ChatGPT"],
      [/\bfriend\s+and\s+cellocegivity\b/gi, "friend and ChatGPT"],
      [/\bfriends\s+cellocegivity\b/gi, "friends and ChatGPT"],
      [/\bfriend\s+cellocegivity\b/gi, "friend and ChatGPT"],
      [/\band\s+cellocegivity\b/gi, "and ChatGPT"],
      [/\bcellocegivity\b/gi, "and ChatGPT"],
      [/\bcello\s+cegivity\b/gi, "and ChatGPT"],
      [/\bcegivity\b/gi, "ChatGPT"],
      [/\bchatgpt\b/gi, "ChatGPT"],
      [/\bheck\s+lot\b/gi, "Hey Claude"],
      [/\btake\s+a\s+lot\s+my\s+name\b/gi, "Hey Claude, my name"],
      [/\btake\s+claude\b/gi, "Hey Claude"],
      [/\btake\s+claudia\b/gi, "Hey Claude"],
      [/\btake\s+claud\b/gi, "Hey Claude"],
      [/\ban\s+i-claudia\b/gi, "in Claude"],
      [/\bi\s+claudia\b/gi, "in Claude"],
      [/\bomi\s*hey\s+claude\b/gi, "Hey Claude"],
      [/\bomi\s*claude\b/gi, "Claude"],
      // WhatsApp acoustic homophones
      [/\bhow\s+(?:the\s+)?what's\s+up\s+works\b/gi, "how WhatsApp works"],
      [/\b(?:the\s+)?what's\s+up\s+works\b/gi, "WhatsApp works"],
      [/\bwhat's\s+up\s+and\s+creative\b/gi, "WhatsApp and creative"],
      [/\bwhat's\s+up\b(?=.*(?:user\s+manual|chatgpt|claude|windows|app|software|features|message|messaging|chat))/gi, "WhatsApp"],
      [/\bwhat's\s+up\s+(?:web|app|group|chat|call|status)\b/gi, "WhatsApp $1"],
      // Microsoft Office & Productivity Suite Normalizations
      [/\bmicrosoft\s+osu\s+system\b/gi, "Microsoft Office system"],
      [/\bmicrosoft\s+osu\b/gi, "Microsoft Office"],
      [/\bosu\s+system\b/gi, "Office system"],
      [/\bmicrosoft\s+office\b/gi, "Microsoft Office"],
      [/\bwindows\s+11\b/gi, "Windows 11"],
      [/\ba\s+operating\s+system\b/gi, "an operating system"],
      [/\ba\s+(operating\s+system|application|api|sdk|interface|update|issue|error|exception|endpoint|object|instance|array|integration|algorithm|optimization|option)\b/gi, "an $1"],
      [/\bby\s+windows\s+11\b/gi, "for Windows 11"],
      [/\bby\s+windows\b/gi, "for Windows"],
      // Developer & Tech Homophones
      [/\bpool\s+requests?\b/gi, "pull request"],
      [/\bfront\s+end\b/gi, "frontend"],
      [/\bback\s+end\b/gi, "backend"],
      [/\bfull\s+stack\b/gi, "full-stack"],
      [/\bopen\s+source\b/gi, "open-source"],
      [/\b(?:pie\s+thon|py\s+thon)\b/gi, "Python"],
      [/\bdock\s+er\b/gi, "Docker"],
      [/\bdocker\b/gi, "Docker"],
      [/\bgit\s+hub\b/gi, "GitHub"],
      [/\byou\s+tube\b/gi, "YouTube"],
      [/\b(?:next\s+js|nextjs)\b/gi, "Next.js"],
      [/\b(?:node\s+js|nodejs)\b/gi, "Node.js"],
      [/\b(?:react\s+js|reactjs)\b/gi, "React"],
      [/\b(?:cloud\s+flare|cloud\s+flayer)\b/gi, "Cloudflare"],
      [/\bmicro\s+soft\b/gi, "Microsoft"],
      [/\bpower\s+point\b/gi, "PowerPoint"],
      [/\b(?:ex\s+cel|ex\s+cell)\b/gi, "Excel"],
      [/\bout\s+look\b/gi, "Outlook"],
      // "Word to win" / "like win" in Office Context
      [/\blike\s+a\s+mail\s*,\s*like\s+win\b/gi, "like Mail, like Word"],
      [/\blike\s+mail\s*,\s*like\s+win\b/gi, "like Mail, like Word"],
      [/\blike\s+win\s*,\s*what\s+else\s+is\s+there\b/gi, "like Word, what else is there"],
      [/\blike\s+win\b(?=.*(?:powerpoint|excel|office|microsoft))/gi, "like Word"],
      [/\b(?:mail|email|outlook)\s*,\s*like\s+win\b/gi, "Mail, like Word"],
      [/\bwin\s*,\s*(?:what\s+else\s+is\s+there\s*,\s*like\s+what\s+)?(?:like\s+)?powerpoint\b/gi, "Word, PowerPoint"],
      [/\bwin\s*,\s*(?:and\s+)?(?:like\s+)?powerpoint\b/gi, "Word, PowerPoint"],
      [/\bpowerpoint\s+excel\b/gi, "PowerPoint, Excel"],
      [/\bpowerpoint\b/gi, "PowerPoint"],
      [/\bexcel\b/gi, "Excel"],
      [/\boutlook\b/gi, "Outlook"],
      [/\bi\s+won't\s+build\b/gi, "I want to build"],
      [/\bi\s+want\s+build\b/gi, "I want to build"],
      [/\bclaude\b/gi, "Claude"],
      [/\bgemini\b/gi, "Gemini"],
      [/\bjavascript\b/gi, "JavaScript"],
      [/\btypescript\b/gi, "TypeScript"],
      [/\bgithub\b/gi, "GitHub"],
      [/\byoutube\b/gi, "YouTube"],
      [/\bvscode\b/gi, "VS Code"],
      [/\bvs\s+code\b/gi, "VS Code"],
      [/\bapi\b/gi, "API"],
      [/\bapis\b/gi, "APIs"],
      [/\bsdk\b/gi, "SDK"],
      [/\bsdks\b/gi, "SDKs"],
      [/\bui\b/gi, "UI"],
      [/\bux\b/gi, "UX"],
      [/\burl\b/gi, "URL"],
      [/\burls\b/gi, "URLs"],
      [/\bjson\b/gi, "JSON"],
      [/\bhtml\b/gi, "HTML"],
      [/\bcss\b/gi, "CSS"],
      [/\bsql\b/gi, "SQL"],
      [/\bsqlite\b/gi, "SQLite"],
      [/\btauri\b/gi, "Tauri"],
      [/\brea\b/gi, "REA"],
      [/\bwindows\b/gi, "Windows"],
      [/\bmacos\b/gi, "macOS"],
      [/\bpr\b/gi, "PR"],
      [/\bprs\b/gi, "PRs"],
      [/\bmr\b/gi, "MR"],
      [/\bmrs\b/gi, "MRs"],
      [/\bllm\b/gi, "LLM"],
      [/\bllms\b/gi, "LLMs"],
      [/\bgpu\b/gi, "GPU"],
      [/\bgpus\b/gi, "GPUs"],
      [/\bcpu\b/gi, "CPU"],
      [/\bcpus\b/gi, "CPUs"],
      [/\bram\b/gi, "RAM"],
      [/\bssd\b/gi, "SSD"],
      [/\bssds\b/gi, "SSDs"],
      [/\bos\b/gi, "OS"],
      [/\bcli\b/gi, "CLI"],
      [/\bgui\b/gi, "GUI"],
      [/\buuid\b/gi, "UUID"],
      [/\bgraphql\b/gi, "GraphQL"],
      [/\bpostgresql\b/gi, "PostgreSQL"],
      [/\bpostgres\b/gi, "Postgres"],
      [/\bmongodb\b/gi, "MongoDB"],
      [/\bredis\b/gi, "Redis"],
      [/\bnginx\b/gi, "Nginx"],
      [/\blinux\b/gi, "Linux"],
      [/\bubuntu\b/gi, "Ubuntu"],
      [/\bvitest\b/gi, "Vitest"],
      [/\bvite\b/gi, "Vite"],
      [/\bwebpack\b/gi, "Webpack"],
      [/\bhttp\b/gi, "HTTP"],
      [/\bhttps\b/gi, "HTTPS"],
      [/\bssh\b/gi, "SSH"],
      [/\bssl\b/gi, "SSL"],
      [/\btls\b/gi, "TLS"],
      [/\bdns\b/gi, "DNS"],
      [/\btcp\b/gi, "TCP"],
      [/\budp\b/gi, "UDP"],
      [/\bci\s*\/\s*cd\b/gi, "CI/CD"],
      [/\bci\s+cd\b/gi, "CI/CD"],
      [/\bsaas\b/gi, "SaaS"],
      [/\bstt\b/gi, "STT"],
      [/\btts\b/gi, "TTS"],
      [/\bvad\b/gi, "VAD"],
      [/\bnlp\b/gi, "NLP"],
      // Phonetic Name & App Brand Fixes
      [/\ba\s+m\s+i\s+y\s+o\b/gi, "Amiyo"],
      [/\bmy\s+name\s+is\s+zumio\s+gari\b/gi, "My name is Amiyo Garai"],
      [/\bmy\s+name\s+is\s+amiyo\s+gari\b/gi, "My name is Amiyo Garai"],
      [/\bmy\s+name\s+is\s+zumio\b/gi, "My name is Amiyo"],
      [/\bzumio\s+gari\b/gi, "Amiyo Garai"],
      [/\bzumio\s+garai\b/gi, "Amiyo Garai"],
      [/\bzomio\s+gari\b/gi, "Amiyo Garai"],
      [/\bzomio\s+garai\b/gi, "Amiyo Garai"],
      [/\bzumiyo\s+gari\b/gi, "Amiyo Garai"],
      [/\bzumiyo\s+garai\b/gi, "Amiyo Garai"],
      [/\bzumiya\s+gari\b/gi, "Amiyo Garai"],
      [/\bzomiya\s+gari\b/gi, "Amiyo Garai"],
      [/\bamiyo\s+gari\b/gi, "Amiyo Garai"],
      [/\bamiya\s+gari\b/gi, "Amiyo Garai"],
      [/\bomiya\s+gari\b/gi, "Amiyo Garai"],
      [/\bomiyo\s+gari\b/gi, "Amiyo Garai"],
      [/\bameyo\s+gari\b/gi, "Amiyo Garai"],
      [/\bomyagurai\b/gi, "Amiyo Garai"],
      [/\bomiya\s+gare\b/gi, "Amiyo Garai"],
      [/\bamiya\s+gare\b/gi, "Amiyo Garai"],
      [/\bomegra\b/gi, "Amiyo Garai"],
      [/\bineira\b/gi, "Amiyo Garai"],
      [/\bzumio\b/gi, "Amiyo"],
      [/\bzomio\b/gi, "Amiyo"],
      [/\bzumiyo\b/gi, "Amiyo"],
      [/\bzumiya\b/gi, "Amiyo"],
      [/\bzomiya\b/gi, "Amiyo"],
      [/\bzumeo\b/gi, "Amiyo"],
      [/\bzomeo\b/gi, "Amiyo"],
      [/\bomiyo\b/gi, "Amiyo"],
      [/\bamio\b/gi, "Amiyo"],
      [/\bameyo\b/gi, "Amiyo"],
      [/\bameio\b/gi, "Amiyo"],
      [/\bamiya\b/gi, "Amiyo"],
      [/\bameya\b/gi, "Amiyo"],
      [/\bamiyo\b/gi, "Amiyo"],
      [/\bomiya\s+flow\b/gi, "AMIYO FLOW"],
      [/\bomiyo\s+flow\b/gi, "AMIYO FLOW"],
      [/\bamiyo\s+flow\b/gi, "AMIYO FLOW"],
      // Advanced Speech Auto-Correction & Typo Repair
      [/\bseplling\b/gi, "spelling"],
      [/\bremovwe\b/gi, "remove"],
      [/\bteh\b/gi, "the"],
      [/\brecieve\b/gi, "receive"],
      [/\brecieved\b/gi, "received"],
      [/\brecieving\b/gi, "receiving"],
      [/\bseperate\b/gi, "separate"],
      [/\bseperated\b/gi, "separated"],
      [/\buntill\b/gi, "until"],
      [/\bdefinately\b/gi, "definitely"],
      [/\boccured\b/gi, "occurred"],
      [/\bthier\b/gi, "their"],
      [/\bwierd\b/gi, "weird"],
      [/\btommorow\b/gi, "tomorrow"],
      [/\btommorrow\b/gi, "tomorrow"],
      [/\bgoverment\b/gi, "government"],
      [/\benviroment\b/gi, "environment"],
      [/\brefering\b/gi, "referring"],
      [/\bwritting\b/gi, "writing"],
      [/\bcommited\b/gi, "committed"],
      [/\bcollegue\b/gi, "colleague"],
      [/\bexistense\b/gi, "existence"],
      [/\bsuccesful\b/gi, "successful"],
      [/\bsuccesfully\b/gi, "successfully"],
      [/\bbegining\b/gi, "beginning"],
      [/\bneccessary\b/gi, "necessary"],
      [/\bunneccessary\b/gi, "unnecessary"],
      [/\btruely\b/gi, "truly"],
      [/\baccomodate\b/gi, "accommodate"],
      [/\bconcious\b/gi, "conscious"],
      [/\bpronounciation\b/gi, "pronunciation"],
      // Spoken grammar, idiom and stutter corrections
      [/\bwhere\s+is\s+ends\b/gi, "where it ends"],
      [/\bwhere\s+is\s+ended\b/gi, "where it ended"],
      [/\band\s+and\b/gi, "and"],
      [/\bthis\s+this\b/gi, "this"],
      [/\bthat\s+that\b/gi, "that"],
      [/\bin\s+in\b/gi, "in"],
      [/\bto\s+to\b/gi, "to"],
      [/\bfor\s+for\b/gi, "for"],
      [/\bwith\s+with\b/gi, "with"],
      [/\bis\s+is\b/gi, "is"],
      [/\bwe\s+we\b/gi, "we"],
      [/\bthe\s+the\b/gi, "the"],
    ];
    for (const [re, repl] of contractions) {
      text = text.replace(re, repl);
    }

    // Space after punctuation followed by letter
    text = text.replace(/([,\.?!;:])([a-zA-Z])/g, '$1 $2');

    // Duplicate punctuation
    text = text.replace(/\.{2,}/g, '.').replace(/,{2,}/g, ',').replace(/\?{2,}/g, '?').replace(/!{2,}/g, '!');

    // Transition word commas
    text = text.replace(
      /\b(however|therefore|furthermore|moreover|meanwhile|in addition|first of all|finally|for example|in fact|as a result)\s+([a-zA-Z])/gi,
      '$1, $2'
    );

    // Sentence-boundary capitalization
    text = text.replace(/(?:^|[.!?\n]\s+)([a-z])/g, (m) => m.toUpperCase());

    // Ensure email addresses remain clean lowercase
    text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (match) => match.toLowerCase());

    // Auto-balance quotes, parentheses, and brackets for complete sentences
    const quoteCount = (text.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      text += '"';
    }
    const openParens = (text.match(/\(/g) || []).length;
    const closeParens = (text.match(/\)/g) || []).length;
    if (openParens > closeParens) {
      text += ')'.repeat(openParens - closeParens);
    }
    const openBrackets = (text.match(/\[/g) || []).length;
    const closeBrackets = (text.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      text += ']'.repeat(openBrackets - closeBrackets);
    }
  }

  // Clean spacing and line breaks
  text = text.replace(/[ \t]+/g, ' ').replace(/ *(\r?\n) */g, '\n').trim();

  // Paragraph formatting and capitalization (smart question mark / period)
  if (text.length > 0) {
    const lines = text.split('\n').map((line) => {
      let trimmed = line.trim();
      trimmed = trimmed.replace(/^[,\s;:.-]+/, '');
      if (!trimmed) return '';
      let cap = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
      if (isInterrogativeSentence(cap)) {
        if (cap.endsWith('.')) {
          cap = cap.slice(0, -1);
        }
        if (!cap.endsWith('?')) {
          cap += '?';
        }
      } else if (cap.endsWith('"') || cap.endsWith(')') || cap.endsWith(']')) {
        // preserve
      } else if (!isIncompleteSentence(cap) && !/[.!?:]$/.test(cap)) {
        cap += '.';
      }
      return cap;
    });
    text = lines.join('\n');
  }

  if (spokenStyle === 'AI Prompt') {
    return engineerStructuredPrompt(text);
  }
  if (spokenStyle === 'Professional') {
    return transformToBusinessStyle(text);
  }
  if (spokenStyle === 'Bullet Points') {
    return transformToBulletPoints(text);
  }
  if (spokenStyle === 'Email') {
    return transformToEmailFormat(text);
  }

  return text;
}

export const WritingStyles: React.FC = () => {
  const { settings, updateSetting } = useSettingsStore();

  const [simulatorInput, setSimulatorInput] = useState(
    'um hello nu we can we can deploy the build basically no wait let us test first period'
  );
  const [newFillerInput, setNewFillerInput] = useState('');

  const customFillers = useMemo(() => {
    return (settings.custom_filler_words || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [settings.custom_filler_words]);

  const addCustomFiller = (word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed || customFillers.includes(trimmed)) return;
    const updated = [...customFillers, trimmed];
    updateSetting('custom_filler_words', updated.join(','));
    setNewFillerInput('');
  };

  const removeCustomFiller = (wordToRemove: string) => {
    const updated = customFillers.filter((w) => w !== wordToRemove);
    updateSetting('custom_filler_words', updated.join(','));
  };

  const isFillersActive = settings.remove_filler_words !== 'false';
  const isRepeatsActive = settings.remove_repeated_words !== 'false';
  const isCorrectionsActive = settings.remove_self_corrections !== 'false';
  const isSentencesActive = settings.clean_sentences !== 'false';

  const simulatedOutput = useMemo(() => {
    return simulateCleanup(
      simulatorInput,
      isFillersActive,
      isRepeatsActive,
      isCorrectionsActive,
      isSentencesActive,
      customFillers
    );
  }, [
    simulatorInput,
    isFillersActive,
    isRepeatsActive,
    isCorrectionsActive,
    isSentencesActive,
    customFillers,
  ]);

  const inputWords = useMemo(
    () => simulatorInput.trim().split(/\s+/).filter(Boolean).length,
    [simulatorInput]
  );
  const outputWords = useMemo(
    () => simulatedOutput.trim().split(/\s+/).filter(Boolean).length,
    [simulatedOutput]
  );
  const reductionPct =
    inputWords > 0 ? Math.max(0, Math.round(((inputWords - outputWords) / inputWords) * 100)) : 0;

  const PRESETS = [
    {
      label: 'Stutters & Hesitations',
      text: 'um hello nu we can we can deploy the build basically',
    },
    {
      label: 'Spoken Self-Correction',
      text: 'we need five no wait six servers for Friday no wait Monday period',
    },
    {
      label: 'Sentence & Grammar Polish',
      text: 'we deployed the server. it works smoothly. dont worry i told them we cant fail period',
    },
    {
      label: 'Question & Number Polish',
      text: 'what time is the team meeting can you check the 50 dollars invoice for 10 percent discount period',
    },
    {
      label: 'Spoken Edit Commands',
      text: 'we have 2 bugs on Friday change Friday to Saturday and change all 2 to 4',
    },
    {
      label: 'Pivot Phrase Backtrack',
      text: 'i try to build chatgpt like application using rea no chatgpt like application',
    },
    {
      label: 'Name & Spelling Auto-Correction',
      text: 'um aa omiya flow was built with wrong seplling but definately recieved high quality',
    },
    {
      label: 'Hello Friend & ChatGPT',
      text: 'Hello, friends, cellocegivity. My name is Zumio Gari and what are you doing this time?',
    },
    {
      label: 'Incomplete Sentence & Seamless Continuation',
      text: 'i try to build chatgpt like application using rea and and start this this where is ends and',
    },
    {
      label: 'Time, Math & Tech Polish',
      text: 'the meeting with rea team is at five thirty PM to review the api with 2 plus 2 equals 4',
    },
    {
      label: 'OpenCode & Mid-Sentence Restart',
      text: "Hey open port, my name is Amiyo Garai, and I try to Hey OpenCode, my name is Amiyo Garai, I try to build a system like a typewriter, so K-A-B-O interface, and what talks we've done",
    },
    {
      label: 'Custom Word Cleanser',
      text: 'so like literally we should push this yaar right now you know',
    },
    {
      label: 'Voice Control: AI Prompt',
      text: 'convert this into a proper prompt: build a chatgpt like application using react and tauri',
    },
    {
      label: 'Voice Control: Business Style',
      text: 'in business style: can we maybe move the meeting to three PM if that works for you',
    },
    {
      label: 'Voice Control: Bullet Points',
      text: 'in bullet points: we need unit tests and release installer and documentation',
    },
    {
      label: 'Voice Control: Email Format',
      text: 'as an email: please review the pull request for the autonomous voice control feature',
    },
    {
      label: 'Office & Productivity: Word, Excel, PowerPoint',
      text: 'Take Claude, my name is Amiyo Garai and I try to build a operating system by Windows 11 and try to build like a file manager and systems and others, load, plug, closely and build a Microsoft OSU system like a mail, like win, what else is there, like what PowerPoint excel system',
    },
    {
      label: 'Irritation Words & Tech Normalization',
      text: 'Take Claude, we need a API and a SDK for pool request, how do you say, let me think we can build with next js and dock er and stuff like that',
    },
    {
      label: 'Syllables & 4-Word Stutters',
      text: 'w- we can we can deploy the production app we can deploy the production app now',
    },
    {
      label: 'Self-Correction & Backtracks',
      text: 'schedule five no make that six servers for Friday or rather Monday',
    },
    {
      label: 'Expanded Contractions & Quote Balancing',
      text: 'we couldntve known where hes going. "open the app and test it',
    },
    {
      label: 'Regional Slang & Thinking Pauses',
      text: 'arre yaar what was I saying we should deploy to production toh phir',
    },
  ];

  const QUICK_SUGGESTIONS = ['like', 'literally', 'yaar', 'arre', 'toh', 'I mean', 'basically', 'actually', 'bhai', 'accha'];

  const styles: StyleDefinition[] = [
    {
      id: 'Professional',
      name: 'Professional & Business',
      icon: Briefcase,
      description: 'Polished executive prose. Crisp, direct, professional, and courteous.',
      exampleSpoken: 'um hey I was just checking if we can maybe move the meeting to three PM if that works for you',
      exampleOutput: 'Would it be possible to reschedule our meeting to 3:00 PM today? Please let me know if that works for your schedule.',
    },
    {
      id: 'Casual',
      name: 'Casual & Conversational',
      icon: Smile,
      description: 'Natural, friendly chat tone suitable for Slack, WhatsApp, and messaging.',
      exampleSpoken: 'so yeah basically I think we should totally push that fix right now you know',
      exampleOutput: 'Yeah, I think we should push that fix right now.',
    },
    {
      id: 'Developer',
      name: 'Developer & Code',
      icon: Terminal,
      description: 'Preserves technical identifiers, syntax, camelCase, snake_case, and terminal commands.',
      exampleSpoken: 'let mutable count equals zero and then call user manager dot fetch active users async',
      exampleOutput: 'let mut count = 0;\nawait userManager.fetchActiveUsers();',
    },
    {
      id: 'Academic',
      name: 'Academic & Formal',
      icon: GraduationCap,
      description: 'Rigorous scholarly diction, complex sentence structures, and objective phrasing.',
      exampleSpoken: 'the data shows that people really like using voice typing instead of keyboards',
      exampleOutput: 'Empirical observations substantiate a statistically significant preference for voice-based dictation over conventional manual keystrokes.',
    },
    {
      id: 'AI Prompt',
      name: 'AI Prompt Mode',
      icon: Bot,
      description: 'Formats dictation into clear, high-performance structured prompts for LLMs (ChatGPT, Claude, Gemini).',
      exampleSpoken: 'I need you to write a python script that parses a log file and extracts ip addresses with errors',
      exampleOutput: 'Task: Write a Python script to parse system log files.\nRequirement: Extract all unique IP addresses associated with error status codes.',
    },
    {
      id: 'Raw',
      name: 'Raw / Verbatim Mode',
      icon: FileText,
      description: 'Pure unaltered speech transcription. Bypasses all AI text processing and restructuring.',
      exampleSpoken: 'um hello testing one two three like you know',
      exampleOutput: 'um hello testing one two three like you know',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto overflow-y-auto h-[calc(100vh-40px)] scroll-smooth custom-scrollbar">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-cyan-400" />
            AI Writing Styles & Persona
          </h1>
          <p className="text-xs text-slate-400">
            Choose how AMIYO FLOW cleans, refines, and formats your spoken words.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-xs text-cyan-300 font-medium">
          Active: {settings.style}
        </div>
      </div>

      {/* Speech Cleanser & Disfluency Removal Section */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5 shadow-xl shadow-black/25">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Speech Cleanser & Disfluency Removal</h2>
                <span className="text-[10px] font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Instant Local
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {[isFillersActive, isRepeatsActive, isCorrectionsActive, isSentencesActive].filter(Boolean).length}/4 Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Eliminate irritating hesitation particles, repeated stutters, and accidental filler words with zero latency.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Equalized Filter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Filler Words */}
          <div
            onClick={() =>
              updateSetting(
                'remove_filler_words',
                settings.remove_filler_words === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isFillersActive
                ? 'bg-amber-950/20 border-amber-500/50 text-white shadow-md shadow-amber-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <VolumeX className="w-4 h-4 text-amber-400" />
                  Remove Filler Words
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isFillersActive
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isFillersActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isFillersActive ? 'bg-amber-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isFillersActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Filters out hesitations, throat clears, and regional slang like <span className="text-amber-300 font-mono">um, aa, nu, na, uh, erm, you know, yaar, toh phir</span>.
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "um hello nu we can start toh phir" →{' '}
                <span className="text-amber-300 font-medium">"Hello we can start."</span>
              </span>
            </div>
          </div>

          {/* 2. Repeated Words & Stutters */}
          <div
            onClick={() =>
              updateSetting(
                'remove_repeated_words',
                settings.remove_repeated_words === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isRepeatsActive
                ? 'bg-cyan-950/20 border-cyan-500/50 text-white shadow-md shadow-cyan-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <Repeat className="w-4 h-4 text-cyan-400" />
                  Remove Stutters
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isRepeatsActive
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isRepeatsActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isRepeatsActive ? 'bg-cyan-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isRepeatsActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Deduplicates hyphenated stutters (<span className="text-cyan-300 font-mono">"w- we"</span>), single words, and multi-word phrases (<span className="text-cyan-300 font-mono">"we can we can"</span>).
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "w- we can we can deploy" →{' '}
                <span className="text-cyan-300 font-medium">"We can deploy."</span>
              </span>
            </div>
          </div>

          {/* 3. Self-Corrections */}
          <div
            onClick={() =>
              updateSetting(
                'remove_self_corrections',
                settings.remove_self_corrections === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isCorrectionsActive
                ? 'bg-emerald-950/20 border-emerald-500/50 text-white shadow-md shadow-emerald-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <Wand2 className="w-4 h-4 text-emerald-400" />
                  Self-Corrections
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isCorrectionsActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isCorrectionsActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isCorrectionsActive ? 'bg-emerald-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isCorrectionsActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Detects backtrack phrases like <span className="text-emerald-300 font-mono">"no wait"</span>, <span className="text-emerald-300 font-mono">"or rather"</span>, <span className="text-emerald-300 font-mono">"make that"</span>, keeping your true speech.
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "Friday or rather Monday" →{' '}
                <span className="text-emerald-300 font-medium">"Monday."</span>
              </span>
            </div>
          </div>

          {/* 4. Smart Sentence & Grammar Polish */}
          <div
            onClick={() =>
              updateSetting(
                'clean_sentences',
                settings.clean_sentences === 'false' ? 'true' : 'false'
              )
            }
            className={`p-4 rounded-xl border transition-all cursor-pointer h-full flex flex-col justify-between space-y-3.5 select-none ${
              isSentencesActive
                ? 'bg-violet-950/20 border-violet-500/50 text-white shadow-md shadow-violet-500/10'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-white">
                  <CheckCheck className="w-4 h-4 text-violet-400" />
                  Clean Sentences
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isSentencesActive
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {isSentencesActive ? 'ACTIVE' : 'OFF'}
                  </span>
                  <div
                    className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                      isSentencesActive ? 'bg-violet-500' : 'bg-slate-800'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        isSentencesActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed min-h-[36px]">
                Capitalizes all sentences, fixes pronoun <span className="text-violet-300 font-mono">"I"</span>, repairs contractions (<span className="text-violet-300 font-mono">don't, couldn't have</span>), and balances quotes.
              </p>
            </div>
            <div className="text-[10px] bg-slate-950/90 rounded-lg p-2.5 border border-slate-800/80 font-mono text-slate-400 min-h-[52px] flex flex-col justify-center">
              <span className="text-slate-600 block text-[9px]">Preview:</span>
              <span>
                "we couldntve failed. \"dont worry" →{' '}
                <span className="text-violet-300 font-medium">"We couldn't have failed. Don't worry."</span>
              </span>
            </div>
          </div>
        </div>

        {/* Silence Auto-Stop & Incomplete Sentence Protection Controls */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-white">Silence Auto-Stop & Clause Protection</h3>
                <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  {settings.vad_auto_stop === 'false' || settings.silence_cutoff_ms === '0'
                    ? 'MANUAL STOP ONLY'
                    : `${(Number(settings.silence_cutoff_ms || '2500') / 1000).toFixed(1)}s WAIT`}
                </span>
                <span className="text-[9px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  Clause Stitching Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Waits 2 to 3 seconds before auto-stopping so you can formulate your thoughts. Never cuts off on incomplete words (&quot;and&quot;, &quot;because&quot;), stitching future speech seamlessly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <select
              value={settings.silence_cutoff_ms || '2500'}
              onChange={(e) => {
                const val = e.target.value;
                updateSetting('silence_cutoff_ms', val);
                updateSetting('vad_auto_stop', val === '0' ? 'false' : 'true');
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-cyan-300 font-medium focus:outline-none"
            >
              <option value="2000">2.0s Pause Wait</option>
              <option value="2500">2.5s Pause Wait (Recommended)</option>
              <option value="3000">3.0s Pause Wait (Relaxed)</option>
              <option value="3500">3.5s Pause Wait (Deep Thinking)</option>
              <option value="4000">4.0s Pause Wait (Maximum)</option>
              <option value="0">Manual Only (No Auto-Stop)</option>
            </select>
          </div>
        </div>

        {/* Custom Filler Words Manager */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-xs font-semibold text-white">Custom Filler Words & Regional Slang</h3>
                <p className="text-[10px] text-slate-400">
                  Add personalized phrases or words you want filtered automatically from dictation.
                </p>
              </div>
            </div>

            {/* Quick Add Suggestions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-mono">Suggestions:</span>
              {QUICK_SUGGESTIONS.map((word) => {
                const isAdded = customFillers.includes(word.toLowerCase());
                return (
                  <button
                    key={word}
                    type="button"
                    disabled={isAdded}
                    onClick={() => addCustomFiller(word)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded transition-colors ${
                      isAdded
                        ? 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                        : 'bg-amber-500/10 text-amber-300 border border-amber-500/25 hover:bg-amber-500/20'
                    }`}
                  >
                    + {word}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Chips & Input */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Default built-in tags */}
            {['um', 'uh', 'nu', 'na', 'erm', 'you know', 'basically'].map((def) => (
              <span
                key={def}
                className="text-[10px] font-mono px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 flex items-center gap-1.5"
                title="Built-in standard filter"
              >
                <span>{def}</span>
                <span className="text-[8px] uppercase tracking-wider text-slate-600 bg-slate-800 px-1 rounded">
                  auto
                </span>
              </span>
            ))}

            {/* User Custom Tags */}
            {customFillers.map((cf) => (
              <span
                key={cf}
                className="text-[10px] font-mono px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center gap-1.5 shadow-sm"
              >
                <span>{cf}</span>
                <button
                  type="button"
                  onClick={() => removeCustomFiller(cf)}
                  className="hover:text-red-400 transition-colors p-0.5"
                  title={`Remove "${cf}"`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {/* Input to add new custom filler */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newFillerInput}
                onChange={(e) => setNewFillerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomFiller(newFillerInput);
                  }
                }}
                placeholder="+ Add custom word..."
                className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 w-36"
              />
              <button
                type="button"
                onClick={() => addCustomFiller(newFillerInput)}
                disabled={!newFillerInput.trim()}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Autonomous Voice Control & Spoken Directives Banner */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-500/40 space-y-3 shadow-lg shadow-cyan-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Mic className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-white">Autonomous Voice Control & Style Directives</h3>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold">
                    Hands-Free Voice AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Speak verbal commands to dynamically trigger AI prompt engineering or switch formats without touching your mouse or keyboard.
                </p>
              </div>
            </div>
            <div className="text-[10px] font-mono text-cyan-300 bg-slate-950/80 px-2.5 py-1 rounded-md border border-cyan-500/30 shrink-0">
              Active Style: <span className="font-bold text-white">{settings.style}</span>
            </div>
          </div>

          {/* Quick Voice Command Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-slate-400 block">Click or speak any voice directive to test:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSimulatorInput('convert this into a proper prompt: build a chatgpt like application using react and tauri')}
                className="p-2.5 rounded-lg bg-slate-900/90 hover:bg-cyan-950/50 border border-cyan-500/30 hover:border-cyan-400 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                  <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  "convert this into a proper prompt"
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  Engineers structured, role-driven prompts for ChatGPT, Claude, and Gemini.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSimulatorInput('in business style: can we maybe move the meeting to three PM if that works for you')}
                className="p-2.5 rounded-lg bg-slate-900/90 hover:bg-cyan-950/50 border border-cyan-500/30 hover:border-cyan-400 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                  <Briefcase className="w-3.5 h-3.5 text-cyan-400" />
                  "in business style:"
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  Elevates colloquial phrasing into polished executive corporate prose.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSimulatorInput('in bullet points: we need unit tests and release installer and documentation')}
                className="p-2.5 rounded-lg bg-slate-900/90 hover:bg-cyan-950/50 border border-cyan-500/30 hover:border-cyan-400 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                  <List className="w-3.5 h-3.5 text-cyan-400" />
                  "in bullet points:"
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  Extracts ideas into structured, indented bullet point items (- item).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSimulatorInput('as an email: please review the pull request for the autonomous voice control feature')}
                className="p-2.5 rounded-lg bg-slate-900/90 hover:bg-cyan-950/50 border border-cyan-500/30 hover:border-cyan-400 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold text-[11px]">
                  <Mail className="w-3.5 h-3.5 text-cyan-400" />
                  "as an email:"
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                  Constructs an executive email with extracted Subject, greeting, and signature.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Live Cleanser Simulator & Token Playground */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  Live Cleanser Simulator & Token Playground
                  <span className="text-[9px] font-mono font-medium px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    0ms Latency
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  Type or test any spoken phrase below to observe instant 0ms heuristic cleaning in real-time.
                </p>
              </div>
            </div>

            {/* Preset Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-500 font-mono">Test Presets:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSimulatorInput(p.text)}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSimulatorInput(
                    'um hello nu we can we can deploy the build basically no wait let us test first period'
                  )
                }
                title="Reset to default test"
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Interactive Playground Panes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Input Pane */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Spoken Speech (Raw Input):</span>
                <span>{inputWords} words</span>
              </div>
              <textarea
                rows={3}
                value={simulatorInput}
                onChange={(e) => setSimulatorInput(e.target.value)}
                placeholder="Type or paste spoken dictation here..."
                className="w-full text-xs font-mono bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 resize-none leading-relaxed"
              />
            </div>

            {/* Cleaned Output Pane */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-cyan-400 font-medium">Cleaned & Inserted Text:</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{outputWords} words</span>
                  {reductionPct > 0 && (
                    <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded text-[9px] font-bold">
                      -{reductionPct}% disfluency
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full text-xs font-mono bg-slate-900/90 border border-cyan-500/40 rounded-lg p-2.5 text-slate-100 min-h-[74px] flex items-center leading-relaxed shadow-inner">
                {simulatedOutput ? (
                  <span className="text-cyan-300 font-medium">{simulatedOutput}</span>
                ) : (
                  <span className="text-slate-600 italic">No output text generated.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Styles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {styles.map((style) => {
          const Icon = style.icon;
          const isSelected = settings.style === style.id;
          return (
            <div
              key={style.id}
              onClick={() => updateSetting('style', style.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 ${
                isSelected
                  ? 'bg-gradient-to-b from-cyan-950/40 to-slate-900 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        isSelected
                          ? 'bg-cyan-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{style.name}</h3>
                      <span className="text-[10px] text-slate-400">AI Context Mode</span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                      isSelected
                        ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                        : 'border-slate-700 bg-slate-800/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {style.description}
                </p>
              </div>

              {/* Before / After Preview */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-[11px]">
                <div>
                  <span className="text-slate-600 block text-[10px] font-mono">Spoken:</span>
                  <p className="text-slate-400 italic">"{style.exampleSpoken}"</p>
                </div>
                <div className="pt-1 border-t border-slate-900">
                  <span className="text-cyan-400/90 block text-[10px] font-mono">Refined & Inserted:</span>
                  <p className="text-slate-200 font-medium whitespace-pre-wrap">{style.exampleOutput}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
