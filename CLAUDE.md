<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**zap** is a development utility tool written in TypeScript.

## Project Structure

This is a new project with minimal structure:
- `main.ts` - Entry point for the application
- `package.json` - Project configuration and dependencies

## Development Commands

Currently no build or test infrastructure is configured. The package.json defines:
- `npm test` - Not yet implemented (placeholder that exits with error)

## Architecture Notes

This project is in early stages. No architectural patterns have been established yet.
