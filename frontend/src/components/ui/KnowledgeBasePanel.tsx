'use client'

import { useEffect, useRef, useState } from 'react'
import { knowledgeApi } from '@/lib/api'
import type { KnowledgeDoc } from '@/lib/api'
import toast from 'react-hot-toast'

export default function KnowledgeBasePanel() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => {
    knowledgeApi.list()
      .then(r => setDocs(r.data.data))
      .catch(() => toast.error('Could not load knowledge base'))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const onUpload = async (file: File | undefined) => {
    if (!file || uploading) return
    setUploading(true)
    try {
      const res = await knowledgeApi.upload(file)
      toast.success(`Embedded "${file.name}" (${res.data.data.chunks} chunks)`)
      refresh()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const onDelete = async (doc: KnowledgeDoc) => {
    if (deleting) return
    setDeleting(doc.source_id)
    try {
      await knowledgeApi.remove(doc.source_id)
      toast.success('Document removed from knowledge base')
      setDocs(prev => prev.filter(d => d.source_id !== doc.source_id))
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-outline-variant/50 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-primary icon-filled">menu_book</span>
          <div>
            <h3 className="font-display text-[15px] font-semibold text-on-surface">Knowledge Base</h3>
            <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">
              RAG corpus — grounds agent answers with citations
            </p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={e => onUpload(e.target.files?.[0])}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-mono text-[11px] uppercase tracking-widest font-bold disabled:opacity-50 transition-all hover:opacity-90"
        >
          <span className="material-symbols-outlined text-[15px]">{uploading ? 'hourglass_empty' : 'upload_file'}</span>
          {uploading ? 'Embedding…' : 'Upload PDF/DOCX'}
        </button>
      </div>

      {loading ? (
        <p className="px-6 py-8 font-mono text-[10px] uppercase tracking-widest text-on-surface-variant">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="px-6 py-10 text-center">
          <span className="material-symbols-outlined text-[40px] text-on-surface-variant/20 mb-2 block">auto_stories</span>
          <p className="font-body text-[13px] text-on-surface-variant">
            No documents yet. Upload policies, handbooks or product docs — agents will cite them in answers.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-outline-variant/20">
          {docs.map(doc => (
            <div key={doc.source_id} className="flex items-center justify-between px-6 py-3.5 gap-3">
              <div className="min-w-0">
                <p className="font-body text-[13px] text-on-surface truncate">{doc.title}</p>
                <p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider mt-0.5">
                  {doc.chunks} chunk{doc.chunks === 1 ? '' : 's'} · {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => onDelete(doc)}
                disabled={deleting === doc.source_id}
                className="shrink-0 p-2 rounded-lg text-on-surface-variant hover:text-on-error-container hover:bg-error-container/40 transition-all disabled:opacity-50"
                title="Delete document"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {deleting === doc.source_id ? 'hourglass_empty' : 'delete'}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
