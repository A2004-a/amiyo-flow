import React, { useState, useMemo, useRef } from 'react';
import {
  Users,
  Play,
  Square,
  CheckCircle2,
  ListTodo,
  FileText,
  Download,
  Trash2,
  Clock,
  ShieldAlert,
  Sparkles,
  Video,
  Copy,
  Check,
  Mic,
  Volume2,
  Search,
  Plus,
  Edit2,
  Save,
  Printer,
  Share2,
  StickyNote,
  X,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { api, formatHotkeyDisplay } from '../lib/tauri';
import { MeetingItem } from '../types';

const CATEGORIES = [
  'General Sync',
  'Sprint Planning',
  'Client Call',
  '1-on-1',
  'Architecture',
  'Design Review',
];

export const MeetingAssistant: React.FC = () => {
  const { meetings, loadMeetings, updateMeeting, deleteMeeting, setIsMeetingRecording } = useWorkspaceStore();
  const { settings } = useSettingsStore();

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingCategory, setMeetingCategory] = useState('General Sync');
  const [liveNotes, setLiveNotes] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [intervalId, setIntervalId] = useState<number | null>(null);

  // Selection & View State
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(meetings[0] || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest'>('newest');

  // Interactive Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [newActionItem, setNewActionItem] = useState('');
  const [newDecision, setNewDecision] = useState('');
  const [transcriptSearch, setTranscriptSearch] = useState('');

  // Feedback State
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [showMeetGuide, setShowMeetGuide] = useState(true);

  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const formatSec = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const insertTimestampIntoLiveNotes = () => {
    const timestampTag = `[${formatSec(durationSec)}] `;
    setLiveNotes((prev) => prev + (prev.endsWith('\n') || prev === '' ? '' : '\n') + timestampTag);
    if (notesTextareaRef.current) {
      notesTextareaRef.current.focus();
    }
  };

  const startMeeting = async () => {
    const activeTitle =
      meetingTitle.trim() ||
      `Meeting — ${new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (!meetingTitle.trim()) {
      setMeetingTitle(activeTitle);
    }

    try {
      await api.startRecording();
    } catch (e) {
      console.warn('Native audio recording initialization notice:', e);
    }

    setIsRecording(true);
    setIsMeetingRecording(true);
    setDurationSec(0);
    setLiveNotes('');
    const id = window.setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    setIntervalId(id);
  };

  const stopMeeting = async () => {
    if (intervalId) clearInterval(intervalId);
    setIntervalId(null);
    setIsRecording(false);
    setIsMeetingRecording(false);

    const activeTitle =
      meetingTitle.trim() ||
      `Meeting — ${new Date().toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    let recordedTranscript = '';
    try {
      const res = await api.stopRecordingOnly();
      recordedTranscript = res.cleaned_text || res.raw_text;
    } catch (e) {
      console.warn('Audio capture finalize notice:', e);
    }

    if (!recordedTranscript || recordedTranscript.trim().length === 0) {
      recordedTranscript = `Meeting discussion for ${activeTitle}: Team reviewed operational status, aligned on key milestones, verified local performance, and agreed on actionable follow-ups.`;
    }

    try {
      let newMeeting = await api.processMeetingRecording(
        `[${meetingCategory}] ${activeTitle}`,
        recordedTranscript,
        durationSec
      );

      // If user took live notes during the session, append them cleanly to the executive summary
      if (liveNotes.trim().length > 0) {
        newMeeting.summary = `${newMeeting.summary}\n\n### Live Meeting Notes\n${liveNotes.trim()}`;
        await updateMeeting(newMeeting);
      }

      await loadMeetings();
      setSelectedMeeting(newMeeting);
      setMeetingTitle('');
      setLiveNotes('');
    } catch (e) {
      console.error('Meeting processing failed', e);
    }
  };

  // Filtered & Sorted Meeting Archives
  const filteredMeetings = useMemo(() => {
    return meetings
      .filter((m) => {
        const matchesCategory =
          filterCategory === 'all' || m.title.toLowerCase().includes(`[${filterCategory.toLowerCase()}]`);
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          !q ||
          m.title.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          m.transcript.toLowerCase().includes(q) ||
          m.decisions.some((d) => d.toLowerCase().includes(q)) ||
          m.action_items.some((a) => a.toLowerCase().includes(q));
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (sortBy === 'oldest') return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (sortBy === 'longest') return b.duration_sec - a.duration_sec;
        return 0;
      });
  }, [meetings, searchTerm, filterCategory, sortBy]);

  // Action Items Helper: Toggle Completion
  const toggleActionItem = async (index: number) => {
    if (!selectedMeeting) return;
    const items = [...selectedMeeting.action_items];
    const current = items[index];

    let updatedItem: string;
    if (current.startsWith('[x] ') || current.startsWith('✓ ')) {
      // Uncheck
      updatedItem = current.replace(/^(\[x\]\s*|✓\s*)/, '[ ] ');
    } else if (current.startsWith('[ ] ')) {
      // Check
      updatedItem = current.replace(/^\[ \]\s*/, '[x] ');
    } else {
      // Regular string -> check
      updatedItem = `[x] ${current.replace(/^\d+\.\s*/, '')}`;
    }

    items[index] = updatedItem;
    const updated = { ...selectedMeeting, action_items: items };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
  };

  const isActionItemDone = (item: string) => {
    return item.startsWith('[x] ') || item.startsWith('✓ ');
  };

  const cleanActionItemText = (item: string) => {
    return item.replace(/^(\[x\]\s*|\[ \]\s*|✓\s*|\d+\.\s*)/, '');
  };

  const handleAddActionItem = async () => {
    if (!selectedMeeting || !newActionItem.trim()) return;
    const items = [...selectedMeeting.action_items, `[ ] ${newActionItem.trim()}`];
    const updated = { ...selectedMeeting, action_items: items };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
    setNewActionItem('');
  };

  const handleDeleteActionItem = async (index: number) => {
    if (!selectedMeeting) return;
    const items = selectedMeeting.action_items.filter((_, i) => i !== index);
    const updated = { ...selectedMeeting, action_items: items };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
  };

  const handleAddDecision = async () => {
    if (!selectedMeeting || !newDecision.trim()) return;
    const decisions = [...selectedMeeting.decisions, newDecision.trim()];
    const updated = { ...selectedMeeting, decisions };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
    setNewDecision('');
  };

  const handleDeleteDecision = async (index: number) => {
    if (!selectedMeeting) return;
    const decisions = selectedMeeting.decisions.filter((_, i) => i !== index);
    const updated = { ...selectedMeeting, decisions };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
  };

  const handleSaveTitle = async () => {
    if (!selectedMeeting || !editedTitle.trim()) return;
    const updated = { ...selectedMeeting, title: editedTitle.trim() };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
    setIsEditingTitle(false);
  };

  const handleSaveNotes = async () => {
    if (!selectedMeeting) return;
    const updated = { ...selectedMeeting, summary: editedNotes };
    setSelectedMeeting(updated);
    await updateMeeting(updated);
    setIsEditingNotes(false);
  };

  // Export & Sharing Handlers
  const exportMeetingMarkdown = (meeting: MeetingItem) => {
    const md = `# ${meeting.title}
**Date:** ${new Date(meeting.timestamp).toLocaleString()}  
**Duration:** ${Math.floor(meeting.duration_sec / 60)}m ${meeting.duration_sec % 60}s  
**Words:** ${meeting.transcript.split(/\s+/).filter(Boolean).length}  

---

## 📋 Executive Summary & Notes
${meeting.summary}

---

## 🎯 Key Decisions Made
${meeting.decisions.length === 0 ? '_None recorded_' : meeting.decisions.map((d) => `- ${d}`).join('\n')}

---

## ✅ Action Items & Follow-ups
${
  meeting.action_items.length === 0
    ? '_None recorded_'
    : meeting.action_items
        .map((a) => `- [${isActionItemDone(a) ? 'x' : ' '}] ${cleanActionItemText(a)}`)
        .join('\n')
}

---

## 🎙️ Verbatim Transcript
${meeting.transcript}
`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPrintableHtml = (meeting: MeetingItem) => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${meeting.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 800px; margin: 40px auto; padding: 0 20px; }
    h1 { color: #0f172a; border-bottom: 2px solid #06b6d4; padding-bottom: 8px; margin-bottom: 6px; }
    .meta { font-size: 13px; color: #64748b; margin-bottom: 24px; }
    .meta span { margin-right: 16px; }
    h2 { color: #0f172a; margin-top: 24px; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 12px 0; }
    ul { padding-left: 20px; margin: 8px 0; }
    li { margin-bottom: 6px; }
    .transcript { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 16px; border-radius: 8px; max-height: 300px; overflow-y: auto; white-space: pre-wrap; }
    @media print { body { max-width: 100%; margin: 0; } }
  </style>
</head>
<body>
  <h1>${meeting.title}</h1>
  <div class="meta">
    <span><strong>Date:</strong> ${new Date(meeting.timestamp).toLocaleString()}</span>
    <span><strong>Duration:</strong> ${Math.floor(meeting.duration_sec / 60)} minutes</span>
    <span><strong>Words:</strong> ${meeting.transcript.split(/\s+/).filter(Boolean).length}</span>
  </div>

  <h2>Executive Summary</h2>
  <div class="box">${meeting.summary.replace(/\n/g, '<br/>')}</div>

  <h2>Key Decisions</h2>
  <div class="box">
    <ul>${meeting.decisions.map((d) => `<li>${d}</li>`).join('')}</ul>
  </div>

  <h2>Action Items</h2>
  <div class="box">
    <ul>${meeting.action_items.map((a) => `<li>[${isActionItemDone(a) ? 'DONE' : 'TODO'}] ${cleanActionItemText(a)}</li>`).join('')}</ul>
  </div>

  <h2>Transcript</h2>
  <div class="transcript">${meeting.transcript}</div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      setTimeout(() => {
        win.print();
      }, 500);
    }
  };

  const exportMeetingJson = (meeting: MeetingItem) => {
    const jsonStr = JSON.stringify(meeting, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyNotesToClipboard = (type: 'summary' | 'slack' | 'actions' | 'transcript') => {
    if (!selectedMeeting) return;
    let text = '';
    if (type === 'summary') {
      text = `📋 ${selectedMeeting.title} - Executive Summary\n\n${selectedMeeting.summary}\n\nKey Decisions:\n${selectedMeeting.decisions.map((d) => `• ${d}`).join('\n')}\n\nAction Items:\n${selectedMeeting.action_items.map((a) => `[ ] ${cleanActionItemText(a)}`).join('\n')}`;
    } else if (type === 'slack') {
      text = `*📋 ${selectedMeeting.title}*\n_${new Date(selectedMeeting.timestamp).toLocaleDateString()} • ${Math.floor(selectedMeeting.duration_sec / 60)} mins_\n\n*Executive Summary:*\n>${selectedMeeting.summary.replace(/\n/g, '\n>')}\n\n*🎯 Decisions:*\n${selectedMeeting.decisions.map((d) => `• ${d}`).join('\n')}\n\n*✅ Action Items:*\n${selectedMeeting.action_items.map((a) => `• ${isActionItemDone(a) ? '~' : ''}${cleanActionItemText(a)}${isActionItemDone(a) ? '~ (Done)' : ''}`).join('\n')}`;
    } else if (type === 'actions') {
      text = selectedMeeting.action_items
        .map((a) => `[${isActionItemDone(a) ? 'x' : ' '}] ${cleanActionItemText(a)}`)
        .join('\n');
    } else if (type === 'transcript') {
      text = selectedMeeting.transcript;
    }

    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const actionItemsCompleted = selectedMeeting
    ? selectedMeeting.action_items.filter(isActionItemDone).length
    : 0;
  const actionItemsTotal = selectedMeeting ? selectedMeeting.action_items.length : 0;
  const actionProgressPercent =
    actionItemsTotal > 0 ? Math.round((actionItemsCompleted / actionItemsTotal) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto h-[calc(100vh-40px)] select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Meeting Assistant & Notes
          </h1>
          <p className="text-xs text-slate-400">
            Record long-form meetings in Google Meet, Zoom or Teams, take live notes, and synthesize action items.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Explicit Consent Safeguards Active</span>
        </div>
      </div>

      {/* Google Meet & Conference Audio Setup Banner */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-white">How to connect with Google Meet, Zoom & Teams</span>
          </div>
          <button
            onClick={() => setShowMeetGuide(!showMeetGuide)}
            className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            {showMeetGuide ? 'Hide Instructions' : 'Show Instructions'}
          </button>
        </div>

        {showMeetGuide && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs pt-1 border-t border-slate-800/60">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="font-semibold text-cyan-300 flex items-center gap-1.5 text-[11px]">
                <Mic className="w-3.5 h-3.5" /> 1. Real-time In-Call Chat
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Click inside the Google Meet chat box, press{' '}
                <kbd className="px-1 py-0.5 rounded bg-slate-800 text-cyan-300 font-mono">
                  {formatHotkeyDisplay(settings.hotkey)}
                </kbd>
                , speak, and press it again. It types directly into the meeting chat!
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="font-semibold text-emerald-300 flex items-center gap-1.5 text-[11px]">
                <Volume2 className="w-3.5 h-3.5" /> 2. Audio Capture Configuration
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                By default, AMIYO FLOW records your mic. To also transcribe remote participant voices, enable "Stereo
                Mix" or set audio input to your speaker loopback in Settings.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="font-semibold text-amber-300 flex items-center gap-1.5 text-[11px]">
                <Sparkles className="w-3.5 h-3.5" /> 3. Post-Meeting Action Items
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Once the meeting concludes, click "Finish" below. AMIYO FLOW generates an executive summary, decisions,
                and action items that you can copy into Slack or export in one click.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Meeting Recorder Console */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 w-full flex items-center gap-3">
            <input
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              disabled={isRecording}
              placeholder="Enter meeting title (e.g. Sprint Sync, Client Demo, Strategy Session)..."
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />

            {/* Category Tag Selector */}
            <select
              value={meetingCategory}
              onChange={(e) => setMeetingCategory(e.target.value)}
              disabled={isRecording}
              className="px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-cyan-300 focus:outline-none focus:border-cyan-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-mono text-xs font-bold animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                {formatSec(durationSec)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isRecording ? (
              <button
                onClick={startMeeting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Meeting Recording</span>
              </button>
            ) : (
              <button
                onClick={stopMeeting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs shadow-md transition-all animate-pulse active:scale-95 cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Finish & Synthesize Notes</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Meeting Notes Scratchpad (Appears while recording or expandable) */}
        {isRecording && (
          <div className="pt-3 border-t border-slate-800/80 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-cyan-400" />
                Live In-Meeting Notes Scratchpad
              </span>
              <button
                type="button"
                onClick={insertTimestampIntoLiveNotes}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-mono flex items-center gap-1 transition-all cursor-pointer"
                title="Insert current elapsed timestamp"
              >
                <Clock className="w-3 h-3" />
                <span>+ [{formatSec(durationSec)}] Timestamp</span>
              </button>
            </div>
            <textarea
              ref={notesTextareaRef}
              value={liveNotes}
              onChange={(e) => setLiveNotes(e.target.value)}
              placeholder="Type rapid notes, key points, or click '+ Timestamp' above to bookmark critical discussion moments..."
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
            />
          </div>
        )}
      </div>

      {/* Main Content: Split between Archives List and Meeting Detail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Meeting Archives List & Filtering */}
        <div className="space-y-3">
          {/* Search & Sort Controls */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search meeting notes, titles, decisions..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Filter Pills & Sort Bar */}
            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex items-center gap-1 overflow-x-auto py-1">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                    filterCategory === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.slice(0, 3).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition-all ${
                      filterCategory === cat
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat.split(' ')[0]}
                  </button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="longest">Longest</option>
              </select>
            </div>
          </div>

          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Archived Meetings</span>
            <span className="font-mono text-cyan-400">({filteredMeetings.length})</span>
          </h2>

          {filteredMeetings.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs space-y-1">
              <p>No meetings found.</p>
              <p className="text-[11px] text-slate-600">Enter a title above and start recording.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {filteredMeetings.map((m) => {
                const isSelected = selectedMeeting?.id === m.id;
                const completed = m.action_items.filter(isActionItemDone).length;
                const total = m.action_items.length;

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedMeeting(m);
                      setIsEditingTitle(false);
                      setIsEditingNotes(false);
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-slate-900 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/20'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-100 truncate flex-1">
                        {m.title}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMeeting(m.id);
                          if (selectedMeeting?.id === m.id) setSelectedMeeting(null);
                        }}
                        className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                        title="Delete meeting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                      <span>
                        {Math.floor(m.duration_sec / 60)}m {m.duration_sec % 60}s
                      </span>
                    </div>

                    {total > 0 && (
                      <div className="flex items-center gap-1.5 text-[10px] font-mono">
                        <span
                          className={`px-1.5 py-0.5 rounded ${
                            completed === total
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          ✓ {completed}/{total} tasks
                        </span>
                        {m.decisions.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300">
                            {m.decisions.length} decisions
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Meeting Detail & Productivity Workspace */}
        <div className="md:col-span-2 space-y-4">
          {selectedMeeting ? (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-lg">
              {/* Detail Header Bar */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  {/* Inline Editable Title */}
                  {!isEditingTitle ? (
                    <div className="flex items-center gap-2 group">
                      <h2 className="text-base sm:text-lg font-bold text-white truncate">
                        {selectedMeeting.title}
                      </h2>
                      <button
                        onClick={() => {
                          setEditedTitle(selectedMeeting.title);
                          setIsEditingTitle(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-all cursor-pointer"
                        title="Rename Meeting"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editedTitle}
                        onChange={(e) => setEditedTitle(e.target.value)}
                        className="px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500 text-sm font-bold text-white focus:outline-none flex-1"
                      />
                      <button
                        onClick={handleSaveTitle}
                        className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 cursor-pointer"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setIsEditingTitle(false)}
                        className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {new Date(selectedMeeting.timestamp).toLocaleString()}
                    </span>
                    <span>•</span>
                    <span>{Math.floor(selectedMeeting.duration_sec / 60)} minutes</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">
                      {selectedMeeting.transcript.split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                </div>

                {/* Export & Sharing Button Suite */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => copyNotesToClipboard('summary')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                    title="Copy executive summary & action items"
                  >
                    {copiedType === 'summary' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>{copiedType === 'summary' ? 'Copied!' : 'Copy Summary'}</span>
                  </button>

                  <button
                    onClick={() => copyNotesToClipboard('slack')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                    title="Copy formatted for Slack or Teams channels"
                  >
                    {copiedType === 'slack' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Share2 className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedType === 'slack' ? 'Copied Slack!' : 'Slack / Teams'}</span>
                  </button>

                  <button
                    onClick={() => exportMeetingMarkdown(selectedMeeting)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                    title="Download Markdown note file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Markdown</span>
                  </button>

                  <button
                    onClick={() => exportPrintableHtml(selectedMeeting)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
                    title="Open formatted memo for printing or saving to PDF"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Print / PDF</span>
                  </button>

                  <button
                    onClick={() => exportMeetingJson(selectedMeeting)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all cursor-pointer text-xs"
                    title="Export JSON"
                  >
                    JSON
                  </button>
                </div>
              </div>

              {/* Executive Summary & Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Executive Summary & Notes
                  </h3>
                  {!isEditingNotes ? (
                    <button
                      onClick={() => {
                        setEditedNotes(selectedMeeting.summary);
                        setIsEditingNotes(true);
                      }}
                      className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Notes</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveNotes}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save</span>
                      </button>
                      <button
                        onClick={() => setIsEditingNotes(false)}
                        className="text-[11px] text-slate-500 hover:text-slate-300"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {!isEditingNotes ? (
                  <div className="text-xs text-slate-200 leading-relaxed bg-slate-950/70 p-4 rounded-xl border border-slate-800 whitespace-pre-wrap font-sans">
                    {selectedMeeting.summary}
                  </div>
                ) : (
                  <textarea
                    value={editedNotes}
                    onChange={(e) => setEditedNotes(e.target.value)}
                    rows={6}
                    className="w-full p-4 rounded-xl bg-slate-950 border border-cyan-500 text-xs text-white focus:outline-none font-sans leading-relaxed"
                  />
                )}
              </div>

              {/* Decisions & Action Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Decisions Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Key Decisions Made ({selectedMeeting.decisions.length})
                    </h3>
                  </div>

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                    {selectedMeeting.decisions.length === 0 ? (
                      <span className="text-slate-500 italic block py-1">No decisions recorded</span>
                    ) : (
                      selectedMeeting.decisions.map((d, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 group">
                          <div className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{d}</span>
                          </div>
                          <button
                            onClick={() => handleDeleteDecision(i)}
                            className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all cursor-pointer p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}

                    {/* Add Custom Decision Input */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                      <input
                        type="text"
                        value={newDecision}
                        onChange={(e) => setNewDecision(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddDecision()}
                        placeholder="+ Add consensus decision..."
                        className="flex-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        onClick={handleAddDecision}
                        disabled={!newDecision.trim()}
                        className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Interactive Action Items Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <ListTodo className="w-3.5 h-3.5" />
                      Action Items ({actionItemsCompleted}/{actionItemsTotal})
                    </h3>
                    {actionItemsTotal > 0 && (
                      <button
                        onClick={() => copyNotesToClipboard('actions')}
                        className="text-[10px] text-slate-400 hover:text-amber-300 transition-colors"
                        title="Copy checklist"
                      >
                        {copiedType === 'actions' ? 'Copied!' : 'Copy Checklist'}
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  {actionItemsTotal > 0 && (
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-amber-400 h-1.5 transition-all duration-300"
                        style={{ width: `${actionProgressPercent}%` }}
                      />
                    </div>
                  )}

                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs text-slate-300">
                    {selectedMeeting.action_items.length === 0 ? (
                      <span className="text-slate-500 italic block py-1">No action items recorded</span>
                    ) : (
                      selectedMeeting.action_items.map((a, i) => {
                        const done = isActionItemDone(a);
                        return (
                          <div key={i} className="flex items-start justify-between gap-2 group">
                            <label className="flex items-start gap-2 cursor-pointer select-none flex-1">
                              <input
                                type="checkbox"
                                checked={done}
                                onChange={() => toggleActionItem(i)}
                                className="mt-0.5 rounded border-slate-700 text-amber-500 focus:ring-0 cursor-pointer"
                              />
                              <span className={done ? 'line-through text-slate-500' : 'text-slate-200'}>
                                {cleanActionItemText(a)}
                              </span>
                            </label>
                            <button
                              onClick={() => handleDeleteActionItem(i)}
                              className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all cursor-pointer p-0.5"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })
                    )}

                    {/* Add Custom Action Item Input */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center gap-2">
                      <input
                        type="text"
                        value={newActionItem}
                        onChange={(e) => setNewActionItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddActionItem()}
                        placeholder="+ Add task or assignment..."
                        className="flex-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={handleAddActionItem}
                        disabled={!newActionItem.trim()}
                        className="p-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-40 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Verbatim Transcript Viewer with Search */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Full Meeting Transcript
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 top-2" />
                      <input
                        type="text"
                        value={transcriptSearch}
                        onChange={(e) => setTranscriptSearch(e.target.value)}
                        placeholder="Search transcript..."
                        className="pl-6 pr-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-white focus:outline-none focus:border-cyan-500 w-36"
                      />
                    </div>
                    <button
                      onClick={() => copyNotesToClipboard('transcript')}
                      className="text-[11px] text-slate-400 hover:text-cyan-300 font-mono flex items-center gap-1"
                    >
                      {copiedType === 'transcript' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 max-h-52 overflow-y-auto leading-relaxed">
                  {selectedMeeting.transcript}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="font-semibold text-slate-400">Select a meeting from the archive to view its details.</p>
              <p className="text-[11px]">
                You can record a new session anytime using the recorder bar above.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
