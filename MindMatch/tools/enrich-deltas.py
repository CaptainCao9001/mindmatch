#!/usr/bin/env python3
"""Enrich job deltas in ideal-profiles.json for better differentiation."""
import json, sys
from copy import deepcopy

DIMS = ["nAch","nPow","nAff","TF","GM","AU","SE","EC","SV","CH","LS","wholistAnalytic","presence","search"]

# Enrichment rules: { "job-id": { "dim": +/-0.10, ... } }
# Values: -0.15 to +0.15, 5-7 non-zero dimensions per job
ENRICH = {
    # === system-builder (base: ↑TF, ↑wholistAnalytic, ↑nAch, ↑CH, ↑search) ===
    "software-engineer":    {"TF":0.05,"wholistAnalytic":0.08,"nAch":0.05,"nAff":-0.05,"CH":0.05,"search":0.05,"AU":-0.05},
    "data-scientist":       {"wholistAnalytic":0.10,"search":0.08,"TF":-0.05,"SE":-0.05,"nAch":0.05,"AU":0.05,"presence":-0.05},
    "ai-engineer":          {"TF":0.10,"CH":0.10,"search":0.08,"nAch":0.08,"wholistAnalytic":0.08,"LS":-0.10,"SV":-0.05},
    "systems-architect":    {"GM":0.10,"wholistAnalytic":0.05,"CH":0.08,"AU":-0.05,"nPow":0.05,"TF":0.05,"presence":-0.05},
    "security-engineer":    {"CH":0.10,"SE":0.08,"wholistAnalytic":0.05,"EC":-0.08,"AU":-0.05,"nAff":-0.05,"GM":-0.05},
    "embedded-engineer":    {"TF":0.05,"SE":0.05,"AU":-0.08,"search":-0.05,"LS":0.05,"CH":0.05,"GM":-0.05},
    "database-admin":       {"SE":0.10,"GM":0.05,"TF":-0.08,"CH":-0.05,"AU":-0.05,"wholistAnalytic":-0.05,"LS":0.05},
    "devops-engineer":      {"GM":0.08,"SE":0.08,"nAch":0.05,"AU":-0.08,"TF":0.05,"LS":-0.05,"CH":0.05},
    "robotics-engineer":    {"TF":0.10,"CH":0.08,"GM":0.05,"nAch":0.05,"wholistAnalytic":0.05,"LS":-0.05,"EC":0.05},

    # === deep-reader (base: ↑wholistAnalytic, ↑nAch, ↑CH, ↑search, ↓nPow, ↓nAff) ===
    "financial-analyst":    {"nAch":0.08,"wholistAnalytic":0.08,"EC":-0.05,"search":0.05,"GM":0.05,"presence":-0.05,"LS":-0.05},
    "researcher-scholar":   {"AU":0.10,"search":0.08,"nPow":-0.08,"GM":-0.05,"CH":0.05,"wholistAnalytic":0.05,"SE":-0.05},
    "strategic-planner":    {"nPow":0.10,"GM":0.08,"presence":0.05,"SV":-0.05,"CH":0.05,"wholistAnalytic":0.05,"AU":-0.05},
    "legal-auditor":        {"SE":0.10,"AU":-0.10,"EC":-0.08,"TF":0.05,"CH":0.05,"search":-0.05,"nAff":-0.05},
    "medical-researcher":   {"SV":0.10,"search":0.08,"SE":0.05,"EC":-0.05,"CH":0.05,"GM":-0.05,"nAch":0.05},
    "quantitative-analyst": {"TF":0.10,"wholistAnalytic":0.10,"nAff":-0.08,"LS":-0.08,"CH":0.05,"SE":-0.05,"SV":-0.05},
    "risk-modeler":         {"SE":0.08,"wholistAnalytic":0.08,"EC":-0.08,"CH":0.05,"TF":0.05,"presence":-0.05,"nAff":-0.05},
    "biostatistician":      {"SV":0.08,"wholistAnalytic":0.08,"nPow":-0.05,"search":0.05,"TF":0.05,"GM":-0.05,"EC":-0.05},
    "actuary":              {"SE":0.10,"wholistAnalytic":0.10,"EC":-0.08,"TF":0.05,"CH":-0.05,"presence":-0.05,"nAff":-0.05},

    # === creative-molder (base: ↑AU, ↑EC, ↑nAch, ↑CH, ↑search, ↓wholistAnalytic, ↓SE) ===
    "ui-designer":          {"TF":0.10,"presence":0.05,"nAff":0.05,"SE":-0.05,"AU":-0.05,"wholistAnalytic":0.05,"LS":0.05},
    "content-creator":      {"AU":0.10,"presence":0.08,"wholistAnalytic":-0.08,"SE":-0.05,"EC":0.05,"nAff":0.05,"GM":-0.05},
    "product-manager":      {"nPow":0.10,"GM":0.10,"SE":0.05,"nAff":0.05,"CH":0.05,"AU":-0.05,"EC":-0.05},
    "video-producer":       {"EC":0.08,"presence":0.08,"nAff":0.05,"wholistAnalytic":-0.05,"AU":0.05,"SE":-0.05,"TF":-0.05},
    "brand-planner":        {"nPow":0.08,"SV":0.05,"GM":0.05,"TF":-0.05,"AU":0.05,"LS":-0.05,"nAff":0.05},
    "ux-designer":          {"nAff":0.08,"TF":0.08,"presence":0.05,"SE":-0.05,"CH":-0.05,"AU":-0.05,"search":0.05},
    "illustrator":          {"AU":0.10,"TF":-0.08,"SE":-0.05,"presence":0.08,"EC":0.05,"GM":-0.08,"nPow":-0.05},
    "art-director":         {"nPow":0.10,"GM":0.08,"LS":0.05,"EC":0.08,"CH":0.05,"SV":-0.05,"presence":0.05},
    "self-media":           {"AU":0.10,"EC":0.10,"SE":-0.10,"presence":0.05,"GM":-0.05,"TF":-0.05,"LS":0.05},

    # === people-connector (base: ↑nAff, ↑SV, ↑GM, ↑presence, ↓TF) ===
    "hr-specialist":        {"GM":0.05,"SV":0.08,"SE":0.05,"nAff":0.05,"nPow":-0.05,"CH":-0.05,"search":-0.05},
    "sales-manager":        {"nAch":0.10,"nPow":0.10,"EC":0.08,"LS":-0.10,"CH":0.08,"SV":-0.08,"presence":-0.05},
    "pr-specialist":        {"EC":0.08,"presence":0.08,"nPow":0.05,"nAff":0.05,"CH":-0.05,"TF":-0.05,"GM":-0.05},
    "marketing-manager":    {"nAch":0.08,"EC":0.08,"CH":0.05,"SE":-0.05,"AU":0.05,"presence":0.05,"GM":-0.05},
    "corporate-trainer":    {"SV":0.10,"presence":0.05,"EC":0.05,"nPow":-0.08,"CH":-0.05,"AU":0.05,"nAff":0.05},
    "account-executive":    {"nAch":0.15,"nPow":0.10,"EC":0.08,"CH":0.08,"SV":-0.08,"LS":-0.10,"presence":-0.05},
    "recruiter":            {"EC":0.05,"SV":0.05,"nAff":0.05,"nPow":-0.05,"CH":-0.05,"GM":0.05,"presence":0.05},
    "community-manager":    {"nAff":0.08,"EC":0.05,"presence":0.05,"SV":0.05,"CH":-0.05,"GM":-0.05,"nPow":-0.05},
    "bd-manager":           {"nAch":0.08,"nPow":0.10,"EC":0.10,"CH":0.08,"SV":-0.05,"LS":-0.10,"GM":0.05},

    # === value-driver (base: ↑nAch, ↑nPow, ↑GM, ↑EC, ↑CH, ↑LS, ↑presence) ===
    "general-manager":      {"GM":0.08,"CH":0.05,"LS":-0.08,"nPow":0.05,"nAch":0.05,"AU":-0.05,"presence":0.05},
    "entrepreneur":         {"AU":0.10,"EC":0.10,"SE":-0.10,"CH":0.08,"LS":-0.08,"GM":0.05,"nAch":0.05},
    "project-manager":      {"GM":0.08,"nPow":-0.08,"SE":0.05,"TF":0.05,"AU":-0.05,"CH":0.05,"LS":0.05},
    "management-consultant": {"TF":0.08,"wholistAnalytic":0.10,"CH":0.05,"LS":-0.08,"nAch":0.05,"GM":0.05,"presence":-0.05},
    "operations-manager":   {"GM":0.08,"nAch":-0.08,"SE":0.05,"TF":0.05,"AU":-0.05,"CH":-0.05,"LS":0.05},
    "investment-manager":   {"nAch":0.10,"SE":-0.08,"wholistAnalytic":0.05,"CH":0.08,"nPow":0.05,"LS":-0.05,"SV":-0.05},
    "regional-director":    {"nPow":0.08,"GM":0.08,"CH":0.05,"EC":0.05,"nAch":0.05,"AU":-0.08,"LS":-0.05},
    "government-official":  {"GM":0.05,"SE":0.08,"EC":-0.10,"SV":0.05,"AU":-0.05,"CH":-0.05,"LS":0.05},
    "nonprofit-exec":       {"SV":0.15,"nPow":-0.08,"nAff":0.05,"EC":-0.08,"GM":0.05,"CH":-0.05,"LS":0.05},

    # === empowerment-companion (base: ↑nAff, ↑SV, ↑SE, ↑presence, ↑search, ↓nPow, ↓TF, ↓GM) ===
    "clinical-psychologist": {"wholistAnalytic":0.10,"search":0.08,"presence":0.05,"EC":-0.08,"TF":0.05,"GM":-0.05,"nAff":0.05},
    "teacher-educator":     {"presence":0.08,"nAff":0.05,"CH":0.05,"SV":-0.05,"GM":0.05,"TF":-0.05,"EC":0.05},
    "registered-nurse":     {"TF":0.10,"SE":0.08,"presence":0.05,"GM":0.05,"AU":-0.05,"wholistAnalytic":-0.05,"SV":0.05},
    "career-counselor":     {"GM":0.10,"search":0.08,"nAff":0.05,"CH":0.05,"TF":0.05,"SE":-0.05,"SV":-0.05},
    "social-worker":        {"nAff":0.05,"presence":0.05,"AU":-0.08,"CH":-0.08,"TF":-0.05,"GM":-0.05,"SV":0.05},
    "occupational-therapist": {"TF":0.05,"wholistAnalytic":0.05,"GM":0.05,"EC":-0.05,"SV":0.05,"CH":-0.05,"AU":-0.05},
    "dietitian":            {"TF":0.05,"wholistAnalytic":0.05,"GM":0.05,"SE":0.05,"EC":-0.05,"CH":-0.05,"presence":0.05},
    "elder-care-worker":    {"SV":0.10,"SE":0.08,"nAff":0.08,"AU":-0.08,"CH":-0.08,"TF":-0.05,"wholistAnalytic":-0.05},
    "youth-counselor":      {"nAff":0.08,"presence":0.08,"EC":0.05,"CH":0.05,"GM":0.05,"SE":-0.05,"wholistAnalytic":-0.05},
}

def enrich():
    path = sys.argv[1] if len(sys.argv) > 1 else 'mock/ideal-profiles.json'
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for dir_key, jobs in data.get('directionJobs', {}).items():
        for job in jobs:
            job_id = job.get('id')
            if job_id in ENRICH:
                rules = ENRICH[job_id]
                delta = {d: rules.get(d, 0.0) for d in DIMS}
                job['delta'] = delta
            else:
                print(f"WARNING: No enrichment for {job_id}", file=sys.stderr)

    # Write
    out_path = sys.argv[2] if len(sys.argv) > 2 else path
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # Report
    total_nonzero = 0
    total_cells = 0
    for dir_key, jobs in data.get('directionJobs', {}).items():
        for job in jobs:
            for d in DIMS:
                if job['delta'].get(d, 0) != 0:
                    total_nonzero += 1
                total_cells += 1
    pct = 100 * total_nonzero / total_cells
    print(f"Enriched: {total_nonzero}/{total_cells} non-zero deltas ({pct:.0f}%) — was ~15%")

if __name__ == '__main__':
    enrich()
