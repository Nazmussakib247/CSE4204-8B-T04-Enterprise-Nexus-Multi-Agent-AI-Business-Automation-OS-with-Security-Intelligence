'use client'

/**
 * Local mock store for job postings — bridges the HR "Post a Job" UI and the
 * public /careers page until the real job_postings/job_applications API and
 * n8n screening pipeline are wired in. Backed by localStorage so a job
 * posted from the HR dashboard actually shows up on /careers in this demo.
 *
 * TODO: replace with GET/POST /api/jobs once the backend is built.
 */

export interface RequiredSkill {
  skill: string
  weight: number
}

export interface MockJob {
  id: string
  title: string
  department: string
  description: string
  screeningCriteria: string
  requiredSkills: RequiredSkill[]
  status: 'open' | 'closed'
  createdAt: string
}

const KEY = 'nexus_mock_jobs'

function readAll(): MockJob[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeAll(jobs: MockJob[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(KEY, JSON.stringify(jobs))
  window.dispatchEvent(new Event('nexus-mock-jobs-updated'))
}

export function getMockJobs(): MockJob[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getOpenMockJobs(): MockJob[] {
  return getMockJobs().filter(j => j.status === 'open')
}

export function addMockJob(job: Omit<MockJob, 'id' | 'createdAt' | 'status'>): MockJob {
  const newJob: MockJob = {
    ...job,
    id: crypto.randomUUID(),
    status: 'open',
    createdAt: new Date().toISOString(),
  }
  writeAll([...readAll(), newJob])
  return newJob
}

export function closeMockJob(id: string) {
  writeAll(readAll().map(j => (j.id === id ? { ...j, status: 'closed' } : j)))
}
