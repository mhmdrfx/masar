export namespace mtr {
	
	export class HealthReport {
	    score: number;
	    severity: string;
	    status: string;
	    detail: string;
	    culpritHop: number;
	
	    static createFrom(source: any = {}) {
	        return new HealthReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.score = source["score"];
	        this.severity = source["severity"];
	        this.status = source["status"];
	        this.detail = source["detail"];
	        this.culpritHop = source["culpritHop"];
	    }
	}
	export class HopStat {
	    hop: number;
	    ip: string;
	    hostname: string;
	    location: string;
	    asn: string;
	    sent: number;
	    received: number;
	    lossPercent: number;
	    lastMs: number;
	    avgMs: number;
	    bestMs: number;
	    worstMs: number;
	    jitterMs: number;
	    history: number[];
	    reachedDest: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HopStat(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hop = source["hop"];
	        this.ip = source["ip"];
	        this.hostname = source["hostname"];
	        this.location = source["location"];
	        this.asn = source["asn"];
	        this.sent = source["sent"];
	        this.received = source["received"];
	        this.lossPercent = source["lossPercent"];
	        this.lastMs = source["lastMs"];
	        this.avgMs = source["avgMs"];
	        this.bestMs = source["bestMs"];
	        this.worstMs = source["worstMs"];
	        this.jitterMs = source["jitterMs"];
	        this.history = source["history"];
	        this.reachedDest = source["reachedDest"];
	    }
	}
	export class TraceSnapshot {
	    running: boolean;
	    target: string;
	    resolvedIp: string;
	    updatedAt: string;
	    hops: HopStat[];
	    health: HealthReport;
	
	    static createFrom(source: any = {}) {
	        return new TraceSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.target = source["target"];
	        this.resolvedIp = source["resolvedIp"];
	        this.updatedAt = source["updatedAt"];
	        this.hops = this.convertValues(source["hops"], HopStat);
	        this.health = this.convertValues(source["health"], HealthReport);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace nettools {
	
	export class DNSRecordItem {
	    type: string;
	    value: string;
	
	    static createFrom(source: any = {}) {
	        return new DNSRecordItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.value = source["value"];
	    }
	}
	export class DNSReport {
	    target: string;
	    queryTimeMs: number;
	    records: DNSRecordItem[];
	    checkedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new DNSReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.target = source["target"];
	        this.queryTimeMs = source["queryTimeMs"];
	        this.records = this.convertValues(source["records"], DNSRecordItem);
	        this.checkedAt = source["checkedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EdgePingItem {
	    provider: string;
	    endpoint: string;
	    latencyMs: number;
	    avgMs: number;
	    bestMs: number;
	    history: number[];
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new EdgePingItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.endpoint = source["endpoint"];
	        this.latencyMs = source["latencyMs"];
	        this.avgMs = source["avgMs"];
	        this.bestMs = source["bestMs"];
	        this.history = source["history"];
	        this.status = source["status"];
	    }
	}
	export class PortResult {
	    port: number;
	    service: string;
	    state: string;
	    latencyMs: number;
	
	    static createFrom(source: any = {}) {
	        return new PortResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.port = source["port"];
	        this.service = source["service"];
	        this.state = source["state"];
	        this.latencyMs = source["latencyMs"];
	    }
	}
	export class PortScanReport {
	    host: string;
	    resolvedIp: string;
	    openCount: number;
	    totalPorts: number;
	    durationMs: number;
	    results: PortResult[];
	
	    static createFrom(source: any = {}) {
	        return new PortScanReport(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.resolvedIp = source["resolvedIp"];
	        this.openCount = source["openCount"];
	        this.totalPorts = source["totalPorts"];
	        this.durationMs = source["durationMs"];
	        this.results = this.convertValues(source["results"], PortResult);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class SpeedSnapshot {
	    running: boolean;
	    phase: string;
	    downloadMbps: number;
	    peakDownloadMbps: number;
	    uploadMbps: number;
	    peakUploadMbps: number;
	    pingMs: number;
	    bestPingMs: number;
	    jitterMs: number;
	    totalMB: number;
	    downloadHistory: number[];
	    uploadHistory: number[];
	    pingHistory: number[];
	    edgePings: EdgePingItem[];
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SpeedSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.phase = source["phase"];
	        this.downloadMbps = source["downloadMbps"];
	        this.peakDownloadMbps = source["peakDownloadMbps"];
	        this.uploadMbps = source["uploadMbps"];
	        this.peakUploadMbps = source["peakUploadMbps"];
	        this.pingMs = source["pingMs"];
	        this.bestPingMs = source["bestPingMs"];
	        this.jitterMs = source["jitterMs"];
	        this.totalMB = source["totalMB"];
	        this.downloadHistory = source["downloadHistory"];
	        this.uploadHistory = source["uploadHistory"];
	        this.pingHistory = source["pingHistory"];
	        this.edgePings = this.convertValues(source["edgePings"], EdgePingItem);
	        this.updatedAt = source["updatedAt"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

