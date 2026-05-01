'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import type { Conversation, ConversationNote } from '@/types';
import TagSelector from './TagSelector';
import {
  Phone, Mail, Plus, Pencil, Trash2, Check, X,
} from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import PlatformBadge from '@/components/common/PlatformBadge';

interface ConversationInfoProps {
  conversationId: string;
  onClose?: () => void;
  onContactRenamed?: (displayName: string) => void;
}

export default function ConversationInfo({ conversationId, onClose, onContactRenamed }: ConversationInfoProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [notes, setNotes] = useState<ConversationNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  const fetchConversation = async () => {
    try {
      const res = await api.get(`/api/conversations/${conversationId}`);
      const data = res.data.data || res.data;
      setConversation(data);
      setNotes(data.notes || []);
    } catch {}
  };

  useEffect(() => {
    fetchConversation();
  }, [conversationId]);

  const handleAddTag = async (tagId: string) => {
    try {
      await api.post(`/api/conversations/${conversationId}/tags`, { tagId });
      fetchConversation();
    } catch (error) {
      console.error('Failed to add tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await api.delete(`/api/conversations/${conversationId}/tags/${tagId}`);
      fetchConversation();
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const response = await api.post(`/api/conversations/${conversationId}/notes`, {
        content: newNote,
      });
      setNotes([response.data, ...notes]);
      setNewNote('');
      setShowNoteInput(false);
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const handleEditNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    try {
      const response = await api.patch(`/api/conversations/${conversationId}/notes/${noteId}`, {
        content: editingNoteContent,
      });
      setNotes(notes.map((n) => (n.id === noteId ? response.data : n)));
      setEditingNoteId(null);
    } catch (error) {
      console.error('Failed to edit note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/api/conversations/${conversationId}/notes/${noteId}`);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleRenameContact = async () => {
    if (!newDisplayName.trim() || !conversation) return;
    try {
      await api.patch(`/api/contacts/${conversation.contact.id}`, {
        displayName: newDisplayName.trim(),
      });
      const updated = { ...conversation, contact: { ...conversation.contact, displayName: newDisplayName.trim() } };
      setConversation(updated);
      setEditingName(false);
      onContactRenamed?.(newDisplayName.trim());
    } catch (error) {
      console.error('Failed to rename contact:', error);
    }
  };

  if (!conversation) {
    return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" /></div>;
  }

  const { contact } = conversation;

  return (
    <div className="flex h-full w-[280px] flex-col border-l border-gray-200 bg-white overflow-y-auto">
      {/* Contact Info */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 text-xl font-medium">
            {contact.avatarUrl ? (
              <img
                src={contact.avatarUrl}
                alt=""
                className="h-16 w-16 rounded-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              contact.displayName.charAt(0).toUpperCase()
            )}
          </div>

          {editingName ? (
            <div className="mt-2 flex items-center gap-1">
              <input
                type="text"
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRenameContact(); if (e.key === 'Escape') setEditingName(false); }}
                className="rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-brand-500 focus:outline-none"
                autoFocus
              />
              <button onClick={handleRenameContact} className="text-green-500 hover:text-green-700"><Check className="h-4 w-4" /></button>
              <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-1">
              <h3 className="text-sm font-semibold">{contact.displayName}</h3>
              <button
                onClick={() => { setNewDisplayName(contact.displayName); setEditingName(true); }}
                className="text-gray-300 hover:text-gray-500"
                title="เปลี่ยนชื่อ"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="mt-2">
            <PlatformBadge platform={conversation.platform} />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" />
              {contact.phone}
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4 text-gray-400" />
              {contact.email}
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="border-b border-gray-200 p-4">
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">Tags</h4>
        <TagSelector
          selectedTagIds={(conversation.tags || []).map((t) => t.tagId)}
          onAdd={handleAddTag}
          onRemove={handleRemoveTag}
        />
      </div>

      {/* Assignments */}
      <div className="border-b border-gray-200 p-4">
        <h4 className="mb-2 text-xs font-semibold uppercase text-gray-400">Assigned To</h4>
        {conversation.assignments && conversation.assignments.length > 0 ? (
          <div className="space-y-2">
            {conversation.assignments.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
                  {a.admin.name.charAt(0)}
                </div>
                <span className="text-sm text-gray-700">{a.admin.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">No one assigned</p>
        )}
      </div>

      {/* Notes */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-gray-400">Internal Notes</h4>
          <button
            onClick={() => setShowNoteInput(!showNoteInput)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showNoteInput && (
          <div className="mb-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <div className="mt-1 flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNoteInput(false);
                  setNewNote('');
                }}
                className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="rounded bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
              >
                Save
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-yellow-50 p-2.5 group relative">
              {editingNoteId === note.id ? (
                <div>
                  <textarea
                    value={editingNoteContent}
                    onChange={(e) => setEditingNoteContent(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none"
                    autoFocus
                  />
                  <div className="mt-1 flex justify-end gap-2">
                    <button
                      onClick={() => setEditingNoteId(null)}
                      className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleEditNote(note.id)}
                      className="rounded bg-brand-600 px-2 py-0.5 text-xs text-white hover:bg-brand-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-700 pr-12">{note.content}</p>
                  <p className="mt-1 text-[10px] text-gray-400">{formatTimeAgo(note.createdAt)}</p>
                  <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                    <button
                      onClick={() => { setEditingNoteId(note.id); setEditingNoteContent(note.content); }}
                      className="rounded p-0.5 text-gray-400 hover:bg-yellow-200 hover:text-gray-600"
                      title="แก้ไข"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="rounded p-0.5 text-gray-400 hover:bg-red-100 hover:text-red-500"
                      title="ลบ"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {notes.length === 0 && !showNoteInput && (
            <p className="text-xs text-gray-400">No notes yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
