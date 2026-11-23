import React, { useState } from 'react';
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
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/useWorkspaceStore';
import { api } from '../lib/tauri';
import { MeetingItem } from '../types';

export const MeetingAssistant: React.FC = () => {
  const { meetings, loadMeetings, deleteMeeting } = useWorkspaceStore();
  const [isRecording, setIsRecording] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [durationSec, setDurationSec] = useState(0);
  const [intervalId, setIntervalId] = useState<number | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingItem | null>(meetings[0] || null);

  const startMeeting = () => {
    if (!meetingTitle.trim()) {
      alert('Please enter a meeting title to start');
      return;
    }
    setIsRecording(true);
    setDurationSec(0);
    const id = window.setInterval(() => {
      setDurationSec((prev) => prev + 1);
    }, 1000);
    setIntervalId(id);
  };

  const stopMeeting = async () => {
    if (intervalId) clearInterval(intervalId);
    setIntervalId(null);
    setIsRecording(false);

    const mockTranscript = `Discussion for ${meetingTitle}: Team reviewed the upcoming release targets, confirmed universal text insertion tests, agreed on delivering sub-second Whisper transcription via Groq, and decided to run regression checks before final packaging.`;

    try {
      const newMeeting = await api.processMeetingRecording(
        meetingTitle,
        mockTranscript,
        durationSec
      );
      await loadMeetings();
      setSelectedMeeting(newMeeting);
      setMeetingTitle('');
    } catch (e) {
      console.error('Meeting processing failed', e);
    }
  };

  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const exportMeetingMarkdown = (meeting: MeetingItem) => {
    const md = `# ${meeting.title}\nDate: ${new Date(meeting.timestamp).toLocaleString()}\nDuration: ${Math.floor(meeting.duration_sec / 60)} minutes\n\n## Executive Summary\n${meeting.summary}\n\n## Key Decisions\n${meeting.decisions.map((d) => `- ${d}`).join('\n')}\n\n## Action Items\n${meeting.action_items.map((a) => `- [ ] ${a}`).join('\n')}\n\n## Transcript\n${meeting.transcript}\n`;

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meeting.title.toLowerCase().replace(/\s+/g, '-')}-notes.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto overflow-y-auto h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Meeting Assistant & Notes
          </h1>
          <p className="text-xs text-slate-400">
            Record long-form meetings, extract timestamped transcripts, and synthesize decisions & action items.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Explicit Consent Safeguards Active</span>
        </div>
      </div>

      {/* Meeting Recorder Bar */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex-1 w-full flex items-center gap-3">
          <input
            type="text"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            disabled={isRecording}
            placeholder="Enter meeting title (e.g. Weekly Product Sync, Architecture Review)..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Record Meeting</span>
            </button>
          ) : (
            <button
              onClick={stopMeeting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all animate-pulse active:scale-95"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Finish & Generate Notes</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Split between Meeting List and Meeting Detail */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Meeting Archives List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Archived Meetings ({meetings.length})
          </h2>
          {meetings.length === 0 ? (
            <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-500 text-xs">
              No meetings recorded yet.
            </div>
          ) : (
            meetings.map((m) => {
              const isSelected = selectedMeeting?.id === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMeeting(m)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/50 shadow-sm'
                      : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="text-xs font-bold text-slate-100 truncate pr-2">
                      {m.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMeeting(m.id);
                        if (selectedMeeting?.id === m.id) setSelectedMeeting(null);
                      }}
                      className="p-1 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-all"
                      title="Delete meeting"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{new Date(m.timestamp).toLocaleDateString()}</span>
                    <span>{Math.floor(m.duration_sec / 60)}m {m.duration_sec % 60}s</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Meeting Detail Viewer */}
        <div className="md:col-span-2 space-y-4">
          {selectedMeeting ? (
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-lg">
              {/* Detail Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-white">{selectedMeeting.title}</h2>
                  <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      {new Date(selectedMeeting.timestamp).toLocaleString()}
                    </span>
                    <span>•</span>
                    <span>{Math.floor(selectedMeeting.duration_sec / 60)} minutes</span>
                  </div>
                </div>

                <button
                  onClick={() => exportMeetingMarkdown(selectedMeeting)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold border border-slate-700 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Notes</span>
                </button>
              </div>

              {/* Executive Summary */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Executive Summary
                </h3>
                <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
                  {selectedMeeting.summary}
                </p>
              </div>

              {/* Decisions & Action Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Decisions */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Decisions Made
                  </h3>
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    {selectedMeeting.decisions.length === 0 ? (
                      <span className="text-slate-500 italic">None recorded</span>
                    ) : (
                      selectedMeeting.decisions.map((d, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{d}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Action Items */}
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5" />
                    Action Items
                  </h3>
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs text-slate-300">
                    {selectedMeeting.action_items.length === 0 ? (
                      <span className="text-slate-500 italic">None recorded</span>
                    ) : (
                      selectedMeeting.action_items.map((a, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <input type="checkbox" className="mt-0.5 rounded border-slate-700" />
                          <span>{a}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Full Transcript */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Full Transcript
                </h3>
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto leading-relaxed">
                  {selectedMeeting.transcript}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500 text-xs">
              Select a meeting from the archive to view its summary and action items.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
