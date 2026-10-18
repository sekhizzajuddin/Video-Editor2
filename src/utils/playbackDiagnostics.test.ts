import { describe, it, expect, beforeEach } from 'vitest';
import { playbackDiagnostics } from './playbackDiagnostics';

describe('playbackDiagnostics', () => {
  beforeEach(() => {
    playbackDiagnostics.clearIncidents();
  });

  it('records transient flight events in circular buffer', () => {
    playbackDiagnostics.recordEvent('seek', 'Seeked to 2.5s', { target: 2.5 });
    playbackDiagnostics.recordEvent('buffer', 'Buffering detected at 2.5s');

    const events = playbackDiagnostics.getFlightEvents();
    expect(events.length).toBe(2);
    expect(events[0].category).toBe('seek');
    expect(events[0].message).toBe('Seeked to 2.5s');
    expect(events[1].category).toBe('buffer');
  });

  it('records an incident and performs automated root-cause analysis', () => {
    // Mock decoders provider
    playbackDiagnostics.registerDecodersDetailProvider(() => [
      {
        clipId: 'clip_video_1',
        mediaId: 'media_1',
        type: 'video',
        readyState: 1,
        readyStateText: 'HAVE_METADATA',
        seeking: true,
        paused: false,
        currentTime: 2.5,
        playbackRate: 1,
        networkState: 2,
        networkStateText: 'NETWORK_LOADING',
        videoWidth: 1920,
        videoHeight: 1080,
        bufferedRanges: [],
        error: null,
        inDOM: true,
        hasAudioGraph: false,
      },
    ]);

    const incident = playbackDiagnostics.recordIncident(
      'BUFFERING_STARTED',
      'Video decoder seeking or waiting for data over 10 consecutive frames'
    );

    expect(incident).not.toBeNull();
    if (incident) {
      expect(incident.type).toBe('BUFFERING_STARTED');
      expect(incident.decoders.length).toBe(1);
      expect(incident.decoders[0].clipId).toBe('clip_video_1');
      expect(incident.analysis.suspectedCulprit).toContain('stalled');
      expect(incident.analysis.diagnosticHints.length).toBeGreaterThan(0);
    }

    const list = playbackDiagnostics.getIncidents();
    expect(list.length).toBe(1);
  });

  it('generates a comprehensive diagnostic report string with JSON', () => {
    playbackDiagnostics.recordEvent('state', 'Playback started');
    const incident = playbackDiagnostics.recordIncident('MANUAL_SNAPSHOT', 'User requested snapshot');
    expect(incident).not.toBeNull();

    const report = playbackDiagnostics.generateReportString(incident);
    expect(report).toContain('PROVISIONED PLAYBACK DIAGNOSTIC REPORT');
    expect(report).toContain('INCIDENT EXECUTIVE SUMMARY');
    expect(report).toContain('HARDWARE & SYSTEM PROFILE');
    expect(report).toContain('FULL RAW JSON SNAPSHOT');

    // Verify embedded JSON is valid
    const jsonMarker = 'FULL RAW JSON SNAPSHOT\n================================================================================\n';
    const jsonPart = report.slice(report.indexOf(jsonMarker) + jsonMarker.length);
    const parsed = JSON.parse(jsonPart);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.incident.id).toBe(incident?.id);
  });
});
