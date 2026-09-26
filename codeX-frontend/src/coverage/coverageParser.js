/**
 * CodeX Universal Code Coverage Parser
 * Level 3E — Code Coverage & Test Intelligence
 *
 * Supported formats:
 * 1. LCOV (lcov.info, coverage.lcov)
 * 2. JSON Summary / Istanbul JSON (coverage-summary.json, coverage-final.json)
 * 3. Go Coverage Profile (coverage.out, mode: set/count/atomic)
 * 4. JaCoCo XML (jacoco.xml)
 * 5. Cobertura XML (cobertura.xml, coverage.xml)
 */

import { CoverageFormat } from './coverageTypes.js';
import {
  ProjectCoverage,
  FileCoverage,
  LineCoverage,
  BranchCoverage,
  FunctionCoverage,
  calculateMetric,
} from './coverageModel.js';

export class CoverageParser {
  /**
   * Detects coverage report format from text content.
   */
  static detectFormat(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') {
      return CoverageFormat.UNKNOWN;
    }

    const trimmed = rawContent.trim();
    if (!trimmed) return CoverageFormat.UNKNOWN;

    // 1. JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.total && (parsed.total.lines || parsed.total.statements)) {
          return CoverageFormat.JSON_SUMMARY;
        }
        const firstKey = Object.keys(parsed)[0];
        if (firstKey && parsed[firstKey] && (parsed[firstKey].statementMap || parsed[firstKey].s)) {
          return CoverageFormat.JSON_ISTANBUL;
        }
        return CoverageFormat.JSON_SUMMARY;
      } catch {
        // Not valid JSON
      }
    }

    // 2. Go coverage profile: "mode: set" / "mode: count" / "mode: atomic"
    if (trimmed.startsWith('mode: ') || /^mode:\s*(set|count|atomic)/m.test(trimmed)) {
      return CoverageFormat.GO_COVER;
    }

    // 3. XML: JaCoCo or Cobertura
    if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      if (trimmed.includes('<report') && trimmed.includes('<sourcefile')) {
        return CoverageFormat.JACOCO_XML;
      }
      if (trimmed.includes('<coverage') && (trimmed.includes('<class') || trimmed.includes('<package'))) {
        return CoverageFormat.COBERTURA_XML;
      }
    }

    // 4. LCOV: starts with TN: or SF:
    if (/^(TN:|SF:)/m.test(trimmed) && trimmed.includes('end_of_record')) {
      return CoverageFormat.LCOV;
    }

    return CoverageFormat.UNKNOWN;
  }

  /**
   * Universal parse entrypoint.
   */
  static parse(rawContent, { workspaceRoot = '', framework = '' } = {}) {
    const format = CoverageParser.detectFormat(rawContent);

    switch (format) {
      case CoverageFormat.LCOV:
        return CoverageParser.parseLcov(rawContent, { workspaceRoot, framework });
      case CoverageFormat.JSON_SUMMARY:
      case CoverageFormat.JSON_ISTANBUL:
        return CoverageParser.parseJson(rawContent, { workspaceRoot, framework });
      case CoverageFormat.GO_COVER:
        return CoverageParser.parseGoCover(rawContent, { workspaceRoot, framework });
      case CoverageFormat.JACOCO_XML:
        return CoverageParser.parseJacocoXml(rawContent, { workspaceRoot, framework });
      case CoverageFormat.COBERTURA_XML:
        return CoverageParser.parseCoberturaXml(rawContent, { workspaceRoot, framework });
      default:
        // Try fallback parsing: LCOV first, then JSON
        try {
          if (rawContent.includes('SF:') && rawContent.includes('end_of_record')) {
            return CoverageParser.parseLcov(rawContent, { workspaceRoot, framework });
          }
        } catch {}
        try {
          return CoverageParser.parseJson(rawContent, { workspaceRoot, framework });
        } catch {}
        throw new Error('Unsupported or unrecognizable coverage report format.');
    }
  }

  /**
   * 1. LCOV Parser
   */
  static parseLcov(content, { workspaceRoot = '', framework = 'lcov' } = {}) {
    const files = {};
    const lines = content.split(/\r?\n/);

    let currentFile = null;
    let lineMap = {};
    let functionList = [];
    let linesFound = 0;
    let linesHit = 0;
    let branchesFound = 0;
    let branchesHit = 0;
    let funcsFound = 0;
    let funcsHit = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (line.startsWith('SF:')) {
        currentFile = line.substring(3).trim();
        lineMap = {};
        functionList = [];
        linesFound = 0;
        linesHit = 0;
        branchesFound = 0;
        branchesHit = 0;
        funcsFound = 0;
        funcsHit = 0;
      } else if (line.startsWith('DA:')) {
        // DA:<line number>,<execution count>[,<checksum>]
        const parts = line.substring(3).split(',');
        const lineNum = Number(parts[0]);
        const hitCount = Number(parts[1]) || 0;

        if (!lineMap[lineNum]) {
          lineMap[lineNum] = new LineCoverage({ lineNumber: lineNum, hitCount });
        } else {
          lineMap[lineNum].hitCount = hitCount;
        }
      } else if (line.startsWith('BRDA:')) {
        // BRDA:<line number>,<block number>,<branch number>,<taken count or '-'>
        const parts = line.substring(5).split(',');
        const lineNum = Number(parts[0]);
        const branchNum = Number(parts[2]);
        const taken = parts[3] === '-' ? 0 : Number(parts[3]) || 0;

        const branchCov = new BranchCoverage({
          line: lineNum,
          branchNumber: branchNum,
          takenCount: taken,
          totalCount: 1,
        });

        if (!lineMap[lineNum]) {
          lineMap[lineNum] = new LineCoverage({ lineNumber: lineNum, hitCount: taken > 0 ? 1 : 0 });
        }
        lineMap[lineNum].branches.push(branchCov);
      } else if (line.startsWith('FN:')) {
        // FN:<line number>,<function name>
        const commaIdx = line.indexOf(',');
        if (commaIdx !== -1) {
          const lineNum = Number(line.substring(3, commaIdx));
          const fnName = line.substring(commaIdx + 1).trim();
          functionList.push(new FunctionCoverage({ name: fnName, lineNumber: lineNum, hitCount: 0 }));
        }
      } else if (line.startsWith('FNDA:')) {
        // FNDA:<hit count>,<function name>
        const commaIdx = line.indexOf(',');
        if (commaIdx !== -1) {
          const hitCount = Number(line.substring(5, commaIdx)) || 0;
          const fnName = line.substring(commaIdx + 1).trim();
          const existing = functionList.find((f) => f.name === fnName);
          if (existing) {
            existing.hitCount = hitCount;
          } else {
            functionList.push(new FunctionCoverage({ name: fnName, lineNumber: 0, hitCount }));
          }
        }
      } else if (line.startsWith('LF:')) {
        linesFound = Number(line.substring(3)) || 0;
      } else if (line.startsWith('LH:')) {
        linesHit = Number(line.substring(3)) || 0;
      } else if (line.startsWith('BRF:')) {
        branchesFound = Number(line.substring(4)) || 0;
      } else if (line.startsWith('BRH:')) {
        branchesHit = Number(line.substring(4)) || 0;
      } else if (line.startsWith('FNF:')) {
        funcsFound = Number(line.substring(4)) || 0;
      } else if (line.startsWith('FNH:')) {
        funcsHit = Number(line.substring(4)) || 0;
      } else if (line === 'end_of_record') {
        if (currentFile) {
          const normalizedPath = currentFile.replace(/\\/g, '/');

          // Compute lines total and hit if not explicitly given
          const lineNums = Object.keys(lineMap);
          if (linesFound === 0 && lineNums.length > 0) {
            linesFound = lineNums.length;
            linesHit = lineNums.filter((num) => lineMap[num].hitCount > 0).length;
          }

          if (funcsFound === 0 && functionList.length > 0) {
            funcsFound = functionList.length;
            funcsHit = functionList.filter((f) => f.hitCount > 0).length;
          }

          const fileCov = new FileCoverage({
            file: normalizedPath,
            fullPath: currentFile,
            lines: { total: linesFound, covered: linesHit },
            statements: { total: linesFound, covered: linesHit }, // LCOV DA maps directly to statements
            functions: { total: funcsFound, covered: funcsHit },
            branches: { total: branchesFound, covered: branchesHit },
            lineMap,
            functionList,
          });

          files[normalizedPath] = fileCov;
        }
        currentFile = null;
      }
    }

    return new ProjectCoverage({
      workspaceRoot,
      framework: framework || 'lcov',
      files,
    });
  }

  /**
   * 2. JSON Parser (Istanbul / json-summary)
   */
  static parseJson(content, { workspaceRoot = '', framework = 'json' } = {}) {
    const data = typeof content === 'string' ? JSON.parse(content) : content;
    const files = {};

    // Check if Istanbul detailed format (s, f, b, statementMap)
    const isIstanbul = Object.values(data).some((val) => val && val.statementMap && val.s);

    if (isIstanbul) {
      for (const [rawPath, fileData] of Object.entries(data)) {
        if (!fileData || typeof fileData !== 'object') continue;

        const normalizedPath = (fileData.path || rawPath).replace(/\\/g, '/');
        const lineMap = {};

        // 1. Statements -> Lines
        const sCounts = fileData.s || {};
        const sMap = fileData.statementMap || {};
        for (const [sId, loc] of Object.entries(sMap)) {
          const startLine = loc.start ? loc.start.line : 1;
          const hitCount = sCounts[sId] || 0;

          if (!lineMap[startLine]) {
            lineMap[startLine] = new LineCoverage({ lineNumber: startLine, hitCount });
          } else {
            lineMap[startLine].hitCount = Math.max(lineMap[startLine].hitCount, hitCount);
          }
        }

        // 2. Branches
        const bCounts = fileData.b || {};
        const bMap = fileData.branchMap || {};
        for (const [bId, bLoc] of Object.entries(bMap)) {
          const startLine = bLoc.loc ? bLoc.loc.start.line : bLoc.line || 1;
          const hits = bCounts[bId] || [];

          hits.forEach((taken, bIdx) => {
            const branch = new BranchCoverage({
              line: startLine,
              branchNumber: bIdx,
              takenCount: taken,
              totalCount: 1,
            });
            if (!lineMap[startLine]) {
              lineMap[startLine] = new LineCoverage({ lineNumber: startLine, hitCount: taken > 0 ? 1 : 0 });
            }
            lineMap[startLine].branches.push(branch);
          });
        }

        // 3. Functions
        const fCounts = fileData.f || {};
        const fMap = fileData.fnMap || {};
        const functionList = [];
        for (const [fId, fnInfo] of Object.entries(fMap)) {
          const fnName = fnInfo.name || `anonymous_${fId}`;
          const fnLine = fnInfo.loc ? fnInfo.loc.start.line : fnInfo.line || 1;
          const hitCount = fCounts[fId] || 0;
          functionList.push(new FunctionCoverage({ name: fnName, lineNumber: fnLine, hitCount }));
        }

        // Compute metrics
        const sTotal = Object.keys(sMap).length;
        const sCovered = Object.values(sCounts).filter((c) => c > 0).length;

        const fTotal = Object.keys(fMap).length;
        const fCovered = Object.values(fCounts).filter((c) => c > 0).length;

        let bTotal = 0;
        let bCovered = 0;
        for (const hits of Object.values(bCounts)) {
          bTotal += hits.length;
          bCovered += hits.filter((c) => c > 0).length;
        }

        const lNums = Object.keys(lineMap);
        const lTotal = lNums.length;
        const lCovered = lNums.filter((l) => lineMap[l].hitCount > 0).length;

        files[normalizedPath] = new FileCoverage({
          file: normalizedPath,
          fullPath: fileData.path || rawPath,
          lines: { total: lTotal, covered: lCovered },
          statements: { total: sTotal, covered: sCovered },
          functions: { total: fTotal, covered: fCovered },
          branches: { total: bTotal, covered: bCovered },
          lineMap,
          functionList,
        });
      }
    } else {
      // json-summary format
      for (const [rawPath, metrics] of Object.entries(data)) {
        if (rawPath === 'total' || !metrics || typeof metrics !== 'object') continue;
        const normalizedPath = rawPath.replace(/\\/g, '/');

        files[normalizedPath] = new FileCoverage({
          file: normalizedPath,
          fullPath: rawPath,
          lines: metrics.lines || { total: 0, covered: 0 },
          statements: metrics.statements || { total: 0, covered: 0 },
          functions: metrics.functions || { total: 0, covered: 0 },
          branches: metrics.branches || { total: 0, covered: 0 },
          lineMap: {},
          functionList: [],
        });
      }
    }

    return new ProjectCoverage({
      workspaceRoot,
      framework: framework || 'json',
      files,
    });
  }

  /**
   * 3. Go Coverage Profile Parser (coverage.out)
   */
  static parseGoCover(content, { workspaceRoot = '', framework = 'go_cover' } = {}) {
    const files = {};
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('mode:')) continue;

      // Format: path/to/file.go:startLine.startCol,endLine.endCol numStatements count
      const match = line.match(/^([^:]+):(\d+)\.(\d+),(\d+)\.(\d+)\s+(\d+)\s+(\d+)$/);
      if (!match) continue;

      const [, filePath, startLineStr, , endLineStr, , numStmtsStr, countStr] = match;
      const normalizedPath = filePath.replace(/\\/g, '/');
      const startLine = Number(startLineStr);
      const endLine = Number(endLineStr);
      const numStmts = Number(numStmtsStr) || 1;
      const count = Number(countStr) || 0;

      if (!files[normalizedPath]) {
        files[normalizedPath] = {
          file: normalizedPath,
          fullPath: filePath,
          statementsTotal: 0,
          statementsCovered: 0,
          lineMap: {},
        };
      }

      const fileEntry = files[normalizedPath];
      fileEntry.statementsTotal += numStmts;
      if (count > 0) {
        fileEntry.statementsCovered += numStmts;
      }

      for (let l = startLine; l <= endLine; l++) {
        if (!fileEntry.lineMap[l]) {
          fileEntry.lineMap[l] = new LineCoverage({ lineNumber: l, hitCount: count });
        } else {
          fileEntry.lineMap[l].hitCount = Math.max(fileEntry.lineMap[l].hitCount, count);
        }
      }
    }

    const processedFiles = {};
    for (const [normPath, entry] of Object.entries(files)) {
      const lineNums = Object.keys(entry.lineMap);
      const linesTotal = lineNums.length;
      const linesCovered = lineNums.filter((l) => entry.lineMap[l].hitCount > 0).length;

      processedFiles[normPath] = new FileCoverage({
        file: normPath,
        fullPath: entry.fullPath,
        lines: { total: linesTotal, covered: linesCovered },
        statements: { total: entry.statementsTotal, covered: entry.statementsCovered },
        functions: { total: 0, covered: 0 },
        branches: { total: 0, covered: 0 },
        lineMap: entry.lineMap,
      });
    }

    return new ProjectCoverage({
      workspaceRoot,
      framework: framework || 'go_test',
      files: processedFiles,
    });
  }

  /**
   * 4. JaCoCo XML Parser
   */
  static parseJacocoXml(xmlContent, { workspaceRoot = '', framework = 'jacoco' } = {}) {
    const files = {};

    // Match packages and sourcefiles
    const packageRegex = /<package\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/package>/g;
    const sourceFileRegex = /<sourcefile\s+name="([^"]*)"[^>]*>([\s\S]*?)<\/sourcefile>/g;
    const lineRegex = /<line\s+nr="(\d+)"\s+(?:mi="(\d+)"\s+)?ci="(\d+)"(?:\s+mb="(\d+)"\s+cb="(\d+)")?[^>]*\/>/g;
    const counterRegex = /<counter\s+type="([^"]+)"\s+missed="(\d+)"\s+covered="(\d+)"[^>]*\/>/g;

    let pkgMatch;
    while ((pkgMatch = packageRegex.exec(xmlContent)) !== null) {
      const pkgPath = pkgMatch[1].replace(/\./g, '/');
      const pkgContent = pkgMatch[2];

      let sfMatch;
      while ((sfMatch = sourceFileRegex.exec(pkgContent)) !== null) {
        const sfName = sfMatch[1];
        const sfContent = sfMatch[2];
        const relativePath = pkgPath ? `${pkgPath}/${sfName}` : sfName;
        const normalizedPath = relativePath.replace(/\\/g, '/');

        const lineMap = {};
        let lMatch;
        while ((lMatch = lineRegex.exec(sfContent)) !== null) {
          const lineNum = Number(lMatch[1]);
          const ci = Number(lMatch[3]) || 0; // instructions covered
          const cb = Number(lMatch[5]) || 0; // branches covered
          const mb = Number(lMatch[4]) || 0; // branches missed

          const lineCov = new LineCoverage({ lineNumber: lineNum, hitCount: ci });

          if (mb > 0 || cb > 0) {
            const totalBranches = mb + cb;
            for (let b = 0; b < totalBranches; b++) {
              lineCov.branches.push(
                new BranchCoverage({
                  line: lineNum,
                  branchNumber: b,
                  takenCount: b < cb ? 1 : 0,
                  totalCount: 1,
                })
              );
            }
          }

          lineMap[lineNum] = lineCov;
        }

        // Counters for this sourcefile
        const metrics = {
          lines: { total: 0, covered: 0 },
          statements: { total: 0, covered: 0 },
          functions: { total: 0, covered: 0 },
          branches: { total: 0, covered: 0 },
        };

        let cMatch;
        while ((cMatch = counterRegex.exec(sfContent)) !== null) {
          const type = cMatch[1];
          const missed = Number(cMatch[2]) || 0;
          const covered = Number(cMatch[3]) || 0;
          const total = missed + covered;

          if (type === 'LINE') {
            metrics.lines = { total, covered };
          } else if (type === 'INSTRUCTION') {
            metrics.statements = { total, covered };
          } else if (type === 'METHOD') {
            metrics.functions = { total, covered };
          } else if (type === 'BRANCH') {
            metrics.branches = { total, covered };
          }
        }

        files[normalizedPath] = new FileCoverage({
          file: normalizedPath,
          fullPath: relativePath,
          lines: metrics.lines,
          statements: metrics.statements.total > 0 ? metrics.statements : metrics.lines,
          functions: metrics.functions,
          branches: metrics.branches,
          lineMap,
        });
      }
    }

    return new ProjectCoverage({
      workspaceRoot,
      framework: framework || 'jacoco',
      files,
    });
  }

  /**
   * 5. Cobertura XML Parser
   */
  static parseCoberturaXml(xmlContent, { workspaceRoot = '', framework = 'cobertura' } = {}) {
    const files = {};

    const classRegex = /<class\s+name="([^"]*)"\s+filename="([^"]*)"[^>]*>([\s\S]*?)<\/class>/g;
    const lineRegex = /<line\s+number="(\d+)"\s+hits="(\d+)"(?:\s+branch="([^"]*)")?(?:\s+condition-coverage="([^"]*)")?[^>]*\/>/g;

    let cMatch;
    while ((cMatch = classRegex.exec(xmlContent)) !== null) {
      const filename = cMatch[2];
      const classContent = cMatch[3];
      const normalizedPath = filename.replace(/\\/g, '/');

      const lineMap = {};
      let linesTotal = 0;
      let linesCovered = 0;
      let branchesTotal = 0;
      let branchesCovered = 0;

      let lMatch;
      while ((lMatch = lineRegex.exec(classContent)) !== null) {
        const lineNum = Number(lMatch[1]);
        const hits = Number(lMatch[2]) || 0;
        const isBranch = lMatch[3] === 'true';
        const condCov = lMatch[4] || '';

        linesTotal++;
        if (hits > 0) linesCovered++;

        const lineCov = new LineCoverage({ lineNumber: lineNum, hitCount: hits });

        if (isBranch && condCov) {
          // e.g. condition-coverage="50% (1/2)"
          const branchMatch = condCov.match(/\((\d+)\/(\d+)\)/);
          if (branchMatch) {
            const bCovered = Number(branchMatch[1]);
            const bTotal = Number(branchMatch[2]);
            branchesTotal += bTotal;
            branchesCovered += bCovered;

            for (let b = 0; b < bTotal; b++) {
              lineCov.branches.push(
                new BranchCoverage({
                  line: lineNum,
                  branchNumber: b,
                  takenCount: b < bCovered ? 1 : 0,
                  totalCount: 1,
                })
              );
            }
          }
        }

        lineMap[lineNum] = lineCov;
      }

      files[normalizedPath] = new FileCoverage({
        file: normalizedPath,
        fullPath: filename,
        lines: { total: linesTotal, covered: linesCovered },
        statements: { total: linesTotal, covered: linesCovered },
        functions: { total: 0, covered: 0 },
        branches: { total: branchesTotal, covered: branchesCovered },
        lineMap,
      });
    }

    return new ProjectCoverage({
      workspaceRoot,
      framework: framework || 'cobertura',
      files,
    });
  }
}
