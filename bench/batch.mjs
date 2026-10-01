#!/usr/bin/env node
// Build first. Usage: node bench/batch.mjs [file.pdf file.hwp ...]
// Without files: synthetic Korean HWPX and text/table PDF workloads (not quality corpora).
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import JSZip from 'jszip'

const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'kordoc-batch-bench-'))
const counts = (process.env.BATCH_JOBS ?? '1,2,4').split(',').map(Number)
const repetitions = Number(process.env.BATCH_REPS ?? 3)

function pdf(pages) {
  const objects = ['', '<< /Type /Catalog /Pages 2 0 R >>', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const kids = []
  for (let page = 0; page < pages; page++) {
    const id = objects.length
    kids.push(`${id} 0 R`)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${id + 1} 0 R >>`)
    const lines = ['BT /F1 10 Tf']
    for (let row = 0; row < 45; row++) {
      lines.push(`1 0 0 1 40 ${750 - row * 15} Tm (Batch benchmark page ${page + 1} row ${row + 1}: document processing sample.) Tj`)
    }
    lines.push('ET')
    for (let r = 0; r <= 10; r++) lines.push(`40 ${50 + r * 20} m 550 ${50 + r * 20} l S`)
    for (let c = 0; c <= 5; c++) lines.push(`${40 + c * 102} 50 m ${40 + c * 102} 250 l S`)
    const stream = lines.join('\n')
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`)
  }
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages} >>`
  let text = '%PDF-1.4\n'
  const offsets = [0]
  for (let i = 1; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(text))
    text += `${i} 0 obj\n${objects[i]}\nendobj\n`
  }
  const xref = Buffer.byteLength(text)
  text += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  text += offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')
  return Buffer.from(text + `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
}

// Sum RSS across the CLI and all descendants. Linux-only sampling; shared pages
// count in each process. This is a memory comparison, not unique physical usage.
function treeRss(pid) {
  let bytes = 0
  try {
    const status = readFileSync(`/proc/${pid}/status`, 'utf8')
    bytes += Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) * 1024
    const children = readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim()
    if (children) for (const child of children.split(/\s+/)) bytes += treeRss(Number(child))
  } catch { /* process exited */ }
  return bytes
}
function hashes(path, prefix = '') {
  const result = []
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const name = prefix + entry.name
    if (entry.isDirectory()) result.push(...hashes(join(path, entry.name), name + '/'))
    else result.push([name, createHash('sha256').update(readFileSync(join(path, entry.name))).digest('hex')])
  }
  return result.sort((a, b) => a[0].localeCompare(b[0]))
}
async function measure(files, jobs, out) {
  const start = performance.now()
  const child = spawn(process.execPath, [cli, ...files, '--jobs', String(jobs), '--silent', '--no-images', '-d', out], { stdio: ['ignore', 'pipe', 'pipe'] })
  let peak = 0, errors = ''
  child.stdout.on('data', data => { errors += data })
  child.stderr.on('data', data => { errors += data })
  const poll = setInterval(() => { peak = Math.max(peak, treeRss(child.pid)) }, 25)
  try {
    await new Promise((done, fail) => {
      child.on('error', fail)
      child.on('exit', code => code === 0 ? done() : fail(new Error(errors)))
    })
    return { seconds: (performance.now() - start) / 1000, rssMiB: peak / 1024 ** 2 }
  } finally { clearInterval(poll) }
}
try {
  let groups
  if (process.argv.length > 2) groups = { supplied: process.argv.slice(2).map(f => resolve(f)) }
  else {
    const zip = await JSZip.loadAsync(readFileSync(new URL('../tests/fixtures/dummy.hwpx', import.meta.url)))
    const section = await zip.file('Contents/section0.xml').async('string')
    const paragraphs = Array.from({ length: 12000 }, (_, i) => `<hp:p><hp:run><hp:t>문서 병렬 처리 성능 측정 ${i}: 한국어 본문을 정확하게 추출합니다.</hp:t></hp:run></hp:p>`).join('')
    zip.file('Contents/section0.xml', section.replace('</hs:sec>', paragraphs + '</hs:sec>'))
    const hwpx = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    groups = {}
    for (const [name, data] of [['hwpx', hwpx], ['pdf', pdf(40)]]) {
      groups[name] = Array.from({ length: 24 }, (_, i) => {
        const path = join(dir, `document-${i}.${name}`)
        writeFileSync(path, data)
        return path
      })
    }
  }
  for (const [group, files] of Object.entries(groups)) {
    let baseline, baselineSeconds
    for (const jobs of counts) {
      const samples = []
      for (let rep = 0; rep < repetitions; rep++) {
        const out = join(dir, `${group}-${jobs}-${rep}`)
        mkdirSync(out)
        samples.push(await measure(files, jobs, out))
        const digest = JSON.stringify(hashes(out))
        baseline ??= digest
        if (digest !== baseline) throw new Error(`Output mismatch: ${group}, jobs=${jobs}`)
        rmSync(out, { recursive: true })
      }
      samples.sort((a, b) => a.seconds - b.seconds)
      const seconds = samples[Math.floor(samples.length / 2)].seconds
      baselineSeconds ??= seconds
      console.log(JSON.stringify({ group, files: files.length, jobs, medianSeconds: +seconds.toFixed(3), speedup: +(baselineSeconds / seconds).toFixed(2), peakTreeRssMiB: +Math.max(...samples.map(s => s.rssMiB)).toFixed(1), identical: true }))
    }
  }
} finally { rmSync(dir, { recursive: true, force: true }) }
