"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeedRampEngine = void 0;
exports.getSpeedRampEngine = getSpeedRampEngine;
exports.getFullKeyframes = getFullKeyframes;
exports.getSpeedAtPosition = getSpeedAtPosition;
exports.getMediaTimeAtPosition = getMediaTimeAtPosition;
exports.getMediaTimeForClip = getMediaTimeForClip;
exports.getRampedTrimEndForRightResize = getRampedTrimEndForRightResize;
exports.getRampedTrimStartForLeftResize = getRampedTrimStartForLeftResize;
var SpeedRampEngine = /** @class */ (function () {
    function SpeedRampEngine(keyframes) {
        this.keyframes = [];
        this.segments = [];
        this.totalTimelineDuration = 0;
        this.setKeyframes(keyframes);
    }
    SpeedRampEngine.prototype.setKeyframes = function (keyframes) {
        var keys = __spreadArray([], keyframes, true);
        if (keys.length === 0) {
            keys = [
                { id: 'start', sourceTime: 0, speed: 1.0, easing: 'linear' },
                { id: 'end', sourceTime: 10000, speed: 1.0, easing: 'linear' }
            ];
        }
        else if (keys.length === 1) {
            keys = [
                { id: keys[0].id, sourceTime: keys[0].sourceTime, speed: keys[0].speed, easing: keys[0].easing, bezierControl: keys[0].bezierControl },
                { id: 'end', sourceTime: keys[0].sourceTime + 10000, speed: keys[0].speed, easing: 'linear' }
            ];
        }
        // Deep copy & sort by source time
        this.keyframes = keys.sort(function (a, b) { return a.sourceTime - b.sourceTime; });
        this.rebuild();
    };
    SpeedRampEngine.prototype.getKeyframes = function () {
        return this.keyframes;
    };
    SpeedRampEngine.prototype.getTotalTimelineDuration = function () {
        return this.totalTimelineDuration;
    };
    SpeedRampEngine.prototype.getSegments = function () {
        return this.segments;
    };
    SpeedRampEngine.prototype.rebuild = function () {
        this.segments = [];
        this.totalTimelineDuration = 0;
        if (this.keyframes.length === 0)
            return;
        for (var i = 0; i < this.keyframes.length - 1; i++) {
            var startKf = this.keyframes[i];
            var endKf = this.keyframes[i + 1];
            var segment = {
                index: i,
                startKf: startKf,
                endKf: endKf,
                sourceStart: startKf.sourceTime,
                sourceEnd: endKf.sourceTime,
                timelineStart: this.totalTimelineDuration,
            };
            this.segments.push(segment);
            this.totalTimelineDuration += this.computeSegmentTimelineDuration(segment);
        }
    };
    SpeedRampEngine.prototype.computeSegmentTimelineDuration = function (seg) {
        var v1 = seg.startKf.speed;
        var v2 = seg.endKf.speed;
        var deltaSource = seg.sourceEnd - seg.sourceStart;
        if (Math.abs(v1) < 1e-10 && Math.abs(v2) < 1e-10) {
            return 0;
        }
        if (Math.abs(v1 - v2) < 1e-10) {
            if (Math.abs(v1) < 1e-10)
                return 0;
            return deltaSource / v1;
        }
        return (deltaSource / (v2 - v1)) * Math.log(v2 / v1);
    };
    SpeedRampEngine.prototype.partialSegmentTimelineDuration = function (seg, sourceTime) {
        var v1 = seg.startKf.speed;
        var v2 = seg.endKf.speed;
        var delta = sourceTime - seg.sourceStart;
        var totalDelta = seg.sourceEnd - seg.sourceStart;
        if (Math.abs(v1 - v2) < 1e-10) {
            if (Math.abs(v1) < 1e-10)
                return 0;
            return delta / v1;
        }
        var ratio = totalDelta > 0.0001 ? delta / totalDelta : 0;
        var currentV = v1 + (v2 - v1) * ratio;
        return (totalDelta / (v2 - v1)) * Math.log(currentV / v1);
    };
    SpeedRampEngine.prototype.sourceToTimeline = function (sourceTime) {
        if (this.keyframes.length === 0)
            return sourceTime;
        if (sourceTime <= this.keyframes[0].sourceTime) {
            var offset_1 = sourceTime - this.keyframes[0].sourceTime;
            return offset_1 / this.keyframes[0].speed;
        }
        var accumulated = 0;
        for (var _i = 0, _a = this.segments; _i < _a.length; _i++) {
            var seg = _a[_i];
            if (sourceTime <= seg.sourceEnd) {
                return seg.timelineStart + this.partialSegmentTimelineDuration(seg, sourceTime);
            }
            accumulated = seg.timelineStart + this.computeSegmentTimelineDuration(seg);
        }
        var lastKf = this.keyframes[this.keyframes.length - 1];
        var offset = sourceTime - lastKf.sourceTime;
        return accumulated + offset / lastKf.speed;
    };
    SpeedRampEngine.prototype.timelineToSource = function (timelineTime) {
        if (this.keyframes.length === 0)
            return timelineTime;
        var firstSeg = this.segments[0];
        var lastSeg = this.segments[this.segments.length - 1];
        if (firstSeg && timelineTime < firstSeg.timelineStart) {
            var offset_2 = timelineTime - firstSeg.timelineStart;
            return this.keyframes[0].sourceTime + offset_2 * this.keyframes[0].speed;
        }
        for (var _i = 0, _a = this.segments; _i < _a.length; _i++) {
            var seg = _a[_i];
            var segDuration = this.computeSegmentTimelineDuration(seg);
            var segEndTime = seg.timelineStart + segDuration;
            if (timelineTime <= segEndTime || seg === lastSeg) {
                var localTime = timelineTime - seg.timelineStart;
                if (seg.startKf.easing === 'bezier') {
                    return this.solveSourceTimeNumerical(seg, localTime);
                }
                return this.solveSourceTimeClosedForm(seg, localTime);
            }
        }
        var lastKf = this.keyframes[this.keyframes.length - 1];
        var lastSegEnd = lastSeg.timelineStart + this.computeSegmentTimelineDuration(lastSeg);
        var offset = timelineTime - lastSegEnd;
        return lastKf.sourceTime + offset * lastKf.speed;
    };
    SpeedRampEngine.prototype.solveSourceTimeClosedForm = function (seg, localT) {
        var v1 = seg.startKf.speed;
        var v2 = seg.endKf.speed;
        var delta = seg.sourceEnd - seg.sourceStart;
        if (Math.abs(v1 - v2) < 1e-10) {
            if (Math.abs(v1) < 1e-10)
                return seg.sourceStart;
            return seg.sourceStart + localT * v1;
        }
        var expTerm = Math.exp((localT * (v2 - v1)) / delta);
        var vAtS = v1 * expTerm;
        return seg.sourceStart + (delta * (vAtS - v1)) / (v2 - v1);
    };
    SpeedRampEngine.prototype.solveSourceTimeNumerical = function (seg, targetLocalT) {
        var low = seg.sourceStart;
        var high = seg.sourceEnd;
        for (var i = 0; i < 50; i++) {
            var mid = (low + high) / 2;
            var midT = this.partialSegmentTimelineDuration(seg, mid);
            if (midT < targetLocalT) {
                low = mid;
            }
            else {
                high = mid;
            }
        }
        return (low + high) / 2;
    };
    SpeedRampEngine.prototype.getSpeedAtSourceTime = function (sourceTime) {
        if (this.keyframes.length === 0)
            return 1.0;
        if (sourceTime <= this.keyframes[0].sourceTime)
            return this.keyframes[0].speed;
        var last = this.keyframes[this.keyframes.length - 1];
        if (sourceTime >= last.sourceTime)
            return last.speed;
        for (var i = 0; i < this.segments.length; i++) {
            var seg = this.segments[i];
            if (sourceTime >= seg.sourceStart && sourceTime <= seg.sourceEnd) {
                return this.interpolateSpeed(seg, sourceTime);
            }
        }
        return 1.0;
    };
    SpeedRampEngine.prototype.interpolateSpeed = function (seg, sourceTime) {
        var delta = seg.sourceEnd - seg.sourceStart;
        var t = delta > 0.0001 ? (sourceTime - seg.sourceStart) / delta : 0;
        var v1 = seg.startKf.speed;
        var v2 = seg.endKf.speed;
        switch (seg.startKf.easing) {
            case 'linear':
                return v1 + (v2 - v1) * t;
            case 'hold':
                return v1;
            case 'easeIn':
                return v1 + (v2 - v1) * (t * t);
            case 'easeOut':
                return v1 + (v2 - v1) * (1 - Math.pow(1 - t, 2));
            case 'easeInOut':
                return v1 + (v2 - v1) * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
            case 'bezier':
                return v1 + (v2 - v1) * this.cubicBezierY(t, seg.startKf.bezierControl);
            default:
                return v1 + (v2 - v1) * t;
        }
    };
    SpeedRampEngine.prototype.cubicBezierY = function (t, control) {
        if (!control)
            return t;
        var p0 = { x: 0, y: 0 };
        var p1 = control.out;
        var p2 = control.in;
        var p3 = { x: 1, y: 1 };
        var u = t;
        for (var i = 0; i < 8; i++) {
            var x = this.bezierValue(u, p0.x, p1.x, p2.x, p3.x);
            var dx = this.bezierDerivative(u, p0.x, p1.x, p2.x, p3.x);
            if (Math.abs(dx) < 1e-6)
                break;
            u = u - (x - t) / dx;
            u = Math.max(0, Math.min(1, u));
        }
        return this.bezierValue(u, p0.y, p1.y, p2.y, p3.y);
    };
    SpeedRampEngine.prototype.bezierValue = function (t, p0, p1, p2, p3) {
        var mt = 1 - t;
        return mt * mt * mt * p0 + 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t * p3;
    };
    SpeedRampEngine.prototype.bezierDerivative = function (t, p0, p1, p2, p3) {
        var mt = 1 - t;
        return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
    };
    SpeedRampEngine.prototype.generateFrameMap = function (timelineStart, timelineEnd, targetFPS, sourceFPS) {
        var maps = [];
        var startFrame = Math.floor(timelineStart * targetFPS);
        var endFrame = Math.ceil(timelineEnd * targetFPS);
        for (var f = startFrame; f <= endFrame; f++) {
            var timelineTime = f / targetFPS;
            var sourceTime = this.timelineToSource(timelineTime);
            var sourceFrame = sourceTime * sourceFPS;
            var speed = this.getSpeedAtSourceTime(sourceTime);
            maps.push({
                timelineFrame: f,
                sourceFrame: sourceFrame,
                speed: speed,
                needsInterpolation: (sourceFrame - Math.floor(sourceFrame)) > 0.01 || speed < 0.8,
            });
        }
        return maps;
    };
    return SpeedRampEngine;
}());
exports.SpeedRampEngine = SpeedRampEngine;
// ============================================================
// ENGINE CACHE FACTORY (Fixes memory leaks)
// ============================================================
var engineCache = new Map();
function getSpeedRampEngine(clipId, ramp) {
    var cacheKey = JSON.stringify(ramp || []);
    var cached = engineCache.get(clipId);
    if (cached && cached.key === cacheKey) {
        return cached.engine;
    }
    var engine = new SpeedRampEngine(ramp || []);
    engineCache.set(clipId, { key: cacheKey, engine: engine });
    if (engineCache.size > 200) {
        var firstKey = engineCache.keys().next().value;
        if (firstKey !== undefined) {
            engineCache.delete(firstKey);
        }
    }
    return engine;
}
// ============================================================
// COMPATIBILITY EXPORTS
// ============================================================
function getFullKeyframes(ramp) {
    if (!ramp || ramp.length === 0) {
        return [
            { id: 'start', sourceTime: 0, speed: 1.0, easing: 'linear' },
            { id: 'end', sourceTime: 10000, speed: 1.0, easing: 'linear' }
        ];
    }
    return __spreadArray([], ramp, true).sort(function (a, b) { return a.sourceTime - b.sourceTime; });
}
function getSpeedAtPosition(ramp, p) {
    if (!ramp || ramp.length < 2)
        return 1.0;
    var engine = new SpeedRampEngine(ramp);
    var duration = engine.getTotalTimelineDuration();
    var timelineTime = p * duration;
    var sourceTime = engine.timelineToSource(timelineTime);
    return engine.getSpeedAtSourceTime(sourceTime);
}
function getMediaTimeAtPosition(clipId, ramp, p, clipDuration) {
    if (!ramp || ramp.length < 2)
        return p * clipDuration;
    var engine = getSpeedRampEngine(clipId, ramp);
    var duration = engine.getTotalTimelineDuration();
    var timelineTime = p * duration;
    return engine.timelineToSource(timelineTime);
}
function getMediaTimeForClip(clip, currentTime) {
    var elapsedTimeline = currentTime - clip.startTime;
    if (!clip.speedRamp || clip.speedRamp.length < 2) {
        return elapsedTimeline * clip.speed + clip.trimStart;
    }
    var engine = getSpeedRampEngine(clip.id, clip.speedRamp);
    var localTimelineStart = engine.sourceToTimeline(clip.trimStart);
    var targetTimelineTime = localTimelineStart + elapsedTimeline;
    return engine.timelineToSource(targetTimelineTime);
}
function getRampedTrimEndForRightResize(clip, newTimelineDuration, maxDuration) {
    if (!clip.speedRamp || clip.speedRamp.length < 2) {
        return Math.max(0, maxDuration - clip.trimStart - newTimelineDuration * clip.speed);
    }
    var engine = getSpeedRampEngine(clip.id, clip.speedRamp);
    var localTimelineStart = engine.sourceToTimeline(clip.trimStart);
    var targetTimelineTime = localTimelineStart + newTimelineDuration;
    var newSourceEnd = engine.timelineToSource(targetTimelineTime);
    return Math.max(0, maxDuration - newSourceEnd);
}
function getRampedTrimStartForLeftResize(clip, shiftOnTimeline) {
    if (!clip.speedRamp || clip.speedRamp.length < 2) {
        return Math.max(0, clip.trimStart + shiftOnTimeline * clip.speed);
    }
    var engine = getSpeedRampEngine(clip.id, clip.speedRamp);
    var localTimelineStart = engine.sourceToTimeline(clip.trimStart);
    var targetTimelineTime = localTimelineStart + shiftOnTimeline;
    return Math.max(0, engine.timelineToSource(targetTimelineTime));
}
var clip = { duration: 8.0, trimStart: 0, trimEnd: 0 };
var maxDuration = 8.0;
var speedRamp = [
    { id: " start, sourceTime: 0.0, speed: 1.0, easing: linear }, },
    { id: kf1, sourceTime: 1.36, speed: 3.33, easing: cubic -  in -out },
    { id: kf2, sourceTime: 4.56, speed: 3.58, easing: cubic -  in -out },
    { id: kf3, sourceTime: 5.84, speed: 3.72, easing: cubic -  in -out },
    { id: end, sourceTime: 8.0, speed: 1.0, easing: linear },
];
var tempEngine = new SpeedRampEngine(speedRamp);
var sourceEnd = maxDuration - clip.trimEnd;
var calculatedDuration = tempEngine.sourceToTimeline(sourceEnd) - tempEngine.sourceToTimeline(clip.trimStart);
console.log(Calculated, duration, calculatedDuration);
