# Streak & Calendar Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a new streak & calendar screen, move streak display to header next to date, remove calendar dropdown from home screen.

**Architecture:** New route `app/streak.tsx` with fire icon hero, adherence bar, and full month calendar grid. Home screen header gets a fire+streak badge that navigates to this screen. Existing CalendarDropdown and its toggle are removed from index.tsx.

**Tech Stack:** React Native, Expo Router, Zustand stores, existing theme system

---

### Task 1: Create `app/streak.tsx`

### Task 2: Add route to `app/_layout.tsx`

### Task 3: Modify home screen header — add fire+streak, remove calendar dropdown, remove streak from hero card
