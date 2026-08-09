import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  VOICE_CONFIG_SCHEMA_V1,
  VOICE_STT_REQUEST_SCHEMA_V1,
  VOICE_TTS_REQUEST_SCHEMA_V1,
  VOICE_TURN_REQUEST_SCHEMA_V1,
  VoiceLocalPttV1,
  composeVoiceTurnV1,
  localBoundedProcessRunnerV1,
  proposeVoiceTurnV1,
  validateVoiceAdapterConfigV1,
  type BoundedProcessRunnerV1,
  type ProcessRequestV1,
  type VoiceAdapterConfigV1,
} from "../packages/contracts/src/index.js";

const ids = {sessionId:"session-1",turnId:"turn-1",correlationId:"correlation-1"};
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function wave(payloadBytes=4): Buffer {
  const bytes=Buffer.alloc(44+payloadBytes);
  bytes.write("RIFF",0,"ascii"); bytes.writeUInt32LE(bytes.length-8,4); bytes.write("WAVE",8,"ascii");
  bytes.write("fmt ",12,"ascii"); bytes.writeUInt32LE(16,16); bytes.writeUInt16LE(1,20); bytes.writeUInt16LE(1,22);
  bytes.writeUInt32LE(16000,24); bytes.writeUInt32LE(32000,28); bytes.writeUInt16LE(2,32); bytes.writeUInt16LE(16,34);
  bytes.write("data",36,"ascii"); bytes.writeUInt32LE(payloadBytes,40); return bytes;
}

async function fixture(): Promise<{directory:string;config:VoiceAdapterConfigV1;cleanup:()=>Promise<void>}> {
  const directory=await mkdtemp(join(tmpdir(),"cm-voice-fixture-"));
  const paths={whisperBinary:join(directory,"whisper-cli"),whisperModel:join(directory,"models","whisper.bin"),ttsBinary:join(directory,"qwen3-tts"),ttsModel:join(directory,"models","qwen.gguf")};
  await (await import("node:fs/promises")).mkdir(join(directory,"models"));
  const contents={whisperBinary:"whisper-binary",whisperModel:"whisper-model",ttsBinary:"tts-binary",ttsModel:"tts-model"};
  for(const key of Object.keys(paths) as (keyof typeof paths)[]) await writeFile(paths[key],contents[key]);
  return {directory,config:{schemaVersion:VOICE_CONFIG_SCHEMA_V1,enabled:true,retention:"EPHEMERAL",...paths,whisperBinaryDigest:digest(contents.whisperBinary),whisperModelDigest:digest(contents.whisperModel),ttsBinaryDigest:digest(contents.ttsBinary),ttsModelDigest:digest(contents.ttsModel),whisperAdapterRevision:"whisper.cpp-1.7.6",ttsAdapterRevision:"qwen3-tts-local-1",timeoutMs:100,maxAudioBytes:1024,maxDurationMs:5000,maxTextBytes:128,maxOutputBytes:1024,maxProcessOutputBytes:64},cleanup:()=>rm(directory,{recursive:true,force:true})};
}

function fakeRunner(cwds:string[]=[]):BoundedProcessRunnerV1 {
  return async (request:ProcessRequestV1) => {
    cwds.push(request.cwd);
    assert.equal(request.executable.includes(";"),false);
    if(request.argv.includes("-of")) await writeFile(`${request.argv[request.argv.indexOf("-of")+1]}.txt`,"Guten Morgen");
    else await writeFile(request.argv[request.argv.indexOf("--output")+1]!,wave());
    return {exitCode:0,stdout:new Uint8Array(),stderr:new Uint8Array()};
  };
}

test("VOICE-M0 exact schemas accept request/result/config/receipt/turn and deny unknown authority",async()=>{
  const f=await fixture();
  try {
    const ajv=new Ajv2020({strict:true});
    for(const path of ["voice-stt-v1.schema.json","voice-tts-v1.schema.json","voice-turn-v1.schema.json","voice-config-v1.schema.json","voice-receipt-v1.schema.json"]) ajv.compile(JSON.parse(await readFile(join(process.cwd(),"schemas/contracts",path),"utf8")));
    assert.equal(validateVoiceAdapterConfigV1(f.config),true);
    const voice=new VoiceLocalPttV1(f.config,fakeRunner());
    const stt=await voice.transcribe({schemaVersion:VOICE_STT_REQUEST_SCHEMA_V1,...ids,language:"de",codec:"wav",audioBytes:4,durationMs:400},Buffer.from("RIFF"));
    const tts=await voice.synthesize({schemaVersion:VOICE_TTS_REQUEST_SCHEMA_V1,...ids,language:"de",text:"Guten Morgen",codec:"wav"});
    assert.equal(tts.audio.byteLength,48);
    const binding={modelDigest:stt.receipt.modelDigest,configDigest:stt.receipt.configDigest};
    const turn=composeVoiceTurnV1(stt.result,stt.receipt,binding);
    assert.equal(turn.result.authority,"NONE"); assert.equal(turn.result.boundary,"CM_GOVERNED_INPUT");
    assert.equal(JSON.stringify(stt.receipt).includes("Guten Morgen"),false);
    assert.equal(JSON.stringify(stt.receipt).includes(f.directory),false);
    assert.equal(stt.receipt.modelDigest,f.config.whisperModelDigest);
    for(const field of ["approval","tool","effect","authorization","execute"]) assert.throws(()=>proposeVoiceTurnV1({schemaVersion:VOICE_TURN_REQUEST_SCHEMA_V1,...ids,language:"de",transcript:"yes",trust:"UNTRUSTED_VOICE_TRANSCRIPT",retention:"EPHEMERAL",modelDigest:"a".repeat(64),configDigest:"b".repeat(64),[field]:true}),/REQUEST_INVALID/);
  } finally {await f.cleanup();}
});

test("VOICE-M0 validates configuration exactly and remains default-off",async()=>{
  const f=await fixture();
  try {
    for(const bad of [{...f.config,extra:true},{...f.config,enabled:"yes"},{...f.config,retention:"FOREVER"},{...f.config,timeoutMs:0},{...f.config,maxAudioBytes:NaN},{...f.config,whisperBinary:"relative"},{...f.config,whisperModel:"/"},{...f.config,ttsModel:f.config.whisperModel},{...f.config,ttsModelDigest:"bad"}]) assert.equal(validateVoiceAdapterConfigV1(bad),false);
    const disabled=new VoiceLocalPttV1({...f.config,enabled:false},fakeRunner());
    await assert.rejects(()=>disabled.transcribe({},new Uint8Array()),/PROFILE_DISABLED/);
  } finally {await f.cleanup();}
});

test("VOICE-M0 adapters fail closed for missing/tampered artifacts and input limits",async()=>{
  const f=await fixture();
  try {
    const request={schemaVersion:VOICE_STT_REQUEST_SCHEMA_V1,...ids,language:"de",codec:"wav",audioBytes:4,durationMs:400};
    await assert.rejects(()=>new VoiceLocalPttV1({...f.config,whisperBinary:join(f.directory,"missing")},fakeRunner()).transcribe(request,Buffer.from("RIFF")),/BINARY_MISSING/);
    await assert.rejects(()=>new VoiceLocalPttV1({...f.config,whisperModel:join(f.directory,"missing-model")},fakeRunner()).transcribe(request,Buffer.from("RIFF")),/MODEL_MISSING/);
    await assert.rejects(()=>new VoiceLocalPttV1({...f.config,whisperModelDigest:"0".repeat(64)},fakeRunner()).transcribe(request,Buffer.from("RIFF")),/MODEL_DIGEST_MISMATCH/);
    for(const bad of [{...request,language:"fr"},{...request,codec:"mp3"},{...request,approval:true},{...request,audioBytes:2000},{...request,durationMs:6000}]) await assert.rejects(()=>new VoiceLocalPttV1(f.config,fakeRunner()).transcribe(bad,Buffer.from("RIFF")));
  } finally {await f.cleanup();}
});

test("VOICE-M0 runner and adapters close timeout, process/output overflow and malformed WAV",async()=>{
  await assert.rejects(()=>localBoundedProcessRunnerV1({executable:"/definitely/missing/cm-voice",argv:[],cwd:tmpdir(),timeoutMs:50,maxStdoutBytes:32,maxStderrBytes:32}),/BINARY_MISSING/);
  await assert.rejects(()=>localBoundedProcessRunnerV1({executable:process.execPath,argv:["-e","setInterval(()=>{},1000)"],cwd:tmpdir(),timeoutMs:20,maxStdoutBytes:32,maxStderrBytes:32}),/TIMEOUT/);
  await assert.rejects(()=>localBoundedProcessRunnerV1({executable:process.execPath,argv:["-e","process.stdout.write('x'.repeat(1000))"],cwd:tmpdir(),timeoutMs:100,maxStdoutBytes:16,maxStderrBytes:16}),/OUTPUT_LIMIT/);
  const f=await fixture();
  try {
    const tts={schemaVersion:VOICE_TTS_REQUEST_SCHEMA_V1,...ids,language:"de",text:"Hallo",codec:"wav"};
    const overflow:BoundedProcessRunnerV1=async()=>({exitCode:0,stdout:Buffer.alloc(65),stderr:new Uint8Array()});
    await assert.rejects(()=>new VoiceLocalPttV1(f.config,overflow).synthesize(tts),/OUTPUT_LIMIT/);
    const malformed:BoundedProcessRunnerV1=async r=>{const bytes=wave();bytes.write("NOPE",8);await writeFile(r.argv.at(-1)!,bytes);return{exitCode:0,stdout:new Uint8Array(),stderr:new Uint8Array()};};
    await assert.rejects(()=>new VoiceLocalPttV1(f.config,malformed).synthesize(tts),/MALFORMED/);
    const wrongSize:BoundedProcessRunnerV1=async r=>{const bytes=wave();bytes.writeUInt32LE(1,4);await writeFile(r.argv.at(-1)!,bytes);return{exitCode:0,stdout:new Uint8Array(),stderr:new Uint8Array()};};
    await assert.rejects(()=>new VoiceLocalPttV1(f.config,wrongSize).synthesize(tts),/MALFORMED/);
  } finally {await f.cleanup();}
});

test("VOICE-M0 correlation/digest mismatch and temporary cleanup fail closed",async()=>{
  const f=await fixture(); const cwds:string[]=[];
  try {
    const voice=new VoiceLocalPttV1(f.config,fakeRunner(cwds));
    const stt=await voice.transcribe({schemaVersion:VOICE_STT_REQUEST_SCHEMA_V1,...ids,language:"de",codec:"wav",audioBytes:4,durationMs:1},Buffer.from("RIFF"));
    const binding={modelDigest:stt.receipt.modelDigest,configDigest:stt.receipt.configDigest};
    assert.throws(()=>composeVoiceTurnV1(stt.result,{...stt.receipt,correlationId:"other"},binding),/CORRELATION_MISMATCH/);
    assert.throws(()=>composeVoiceTurnV1(stt.result,stt.receipt,{...binding,modelDigest:"0".repeat(64)}),/DIGEST_MISMATCH/);
    assert.throws(()=>composeVoiceTurnV1(stt.result,stt.receipt,{...binding,configDigest:"0".repeat(64)}),/DIGEST_MISMATCH/);
    await assert.rejects(stat(cwds[0]!));
    const failing:BoundedProcessRunnerV1=async r=>{cwds.push(r.cwd);throw new Error("VOICE_RUNNER_TIMEOUT");};
    await assert.rejects(()=>new VoiceLocalPttV1(f.config,failing).synthesize({schemaVersion:VOICE_TTS_REQUEST_SCHEMA_V1,...ids,language:"de",text:"Hallo",codec:"wav"}),/TIMEOUT/);
    await assert.rejects(stat(cwds.at(-1)!));
  } finally {await f.cleanup();}
});
