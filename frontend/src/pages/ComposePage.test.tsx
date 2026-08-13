import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ComposePage } from "./ComposePage";
import type { ParsedLeads } from "../types/leads";

const { mockNavigate, mockScheduleEmails } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockScheduleEmails: vi.fn()
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate
}));

vi.mock("../services/email.service", () => ({
  scheduleEmails: mockScheduleEmails
}));

vi.mock("../components/leads/LeadUpload", () => ({
  LeadUpload: ({ onChange }: { onChange: (leads: ParsedLeads | null) => void }) => (
    <button type="button" onClick={() => onChange(leadsFixture)}>
      fake-upload
    </button>
  )
}));

const leadsFixture: ParsedLeads = {
  filename: "leads.csv",
  validEmails: ["alice@example.com", "bob@example.com"],
  invalidEntries: [],
  duplicateCount: 0,
  totalMatches: 2
};

function localDateTimeString(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function submitForm() {
  const form = screen.getByRole("button", { name: /^send$/i }).closest("form");
  if (!form) {
    throw new Error("Send button is not inside a form");
  }
  fireEvent.submit(form);
}

function fillCompose(overrides: { startTime?: string } = {}) {
  const futureTime = overrides.startTime ?? localDateTimeString(new Date(Date.now() + 10 * 60_000));

  fireEvent.change(screen.getByPlaceholderText("Subject"), { target: { value: "Hello" } });
  fireEvent.change(screen.getByPlaceholderText("Hi, I wanted to reach out..."), {
    target: { value: "World" }
  });
  fireEvent.change(screen.getByLabelText(/Start time/), { target: { value: futureTime } });
  fireEvent.click(screen.getByText("fake-upload"));
}

describe("ComposePage", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockScheduleEmails.mockReset();
    mockScheduleEmails.mockResolvedValue({ count: 2, jobs: [] });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the compose form", () => {
    render(<ComposePage />);

    expect(screen.getByPlaceholderText("Subject")).toBeTruthy();
    expect(screen.getByPlaceholderText("Hi, I wanted to reach out...")).toBeTruthy();
    expect(screen.getByText("Compose New Email")).toBeTruthy();
  });

  it("defaults the start time to a future local time", () => {
    render(<ComposePage />);
    const startInput = screen.getByLabelText(/Start time/) as HTMLInputElement;

    expect(startInput.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(new Date(startInput.value).getTime()).toBeGreaterThan(Date.now());
  });

  it("requires a subject", () => {
    render(<ComposePage />);
    submitForm();

    expect(screen.getByText("Subject is required.")).toBeTruthy();
    expect(mockScheduleEmails).not.toHaveBeenCalled();
  });

  it("requires a body", () => {
    render(<ComposePage />);
    fireEvent.change(screen.getByPlaceholderText("Subject"), { target: { value: "Hello" } });
    submitForm();

    expect(screen.getByText("Body is required.")).toBeTruthy();
  });

  it("requires at least one valid lead", () => {
    render(<ComposePage />);
    fireEvent.change(screen.getByPlaceholderText("Subject"), { target: { value: "Hello" } });
    fireEvent.change(screen.getByPlaceholderText("Hi, I wanted to reach out..."), {
      target: { value: "World" }
    });
    submitForm();

    expect(
      screen.getByText("Upload a CSV or TXT file with at least one valid email address.")
    ).toBeTruthy();
  });

  it("rejects a start time in the past", () => {
    render(<ComposePage />);
    fillCompose({ startTime: localDateTimeString(new Date(Date.now() - 60_000)) });
    submitForm();

    expect(screen.getByText("Start time must be in the future.")).toBeTruthy();
    expect(mockScheduleEmails).not.toHaveBeenCalled();
  });

  it("rejects a negative delay between emails", () => {
    render(<ComposePage />);
    fillCompose();
    fireEvent.change(screen.getByLabelText(/Delay between/), { target: { value: "-1" } });
    submitForm();

    expect(screen.getByText("Delay between emails cannot be negative.")).toBeTruthy();
    expect(mockScheduleEmails).not.toHaveBeenCalled();
  });

  it("rejects a zero hourly limit", () => {
    render(<ComposePage />);
    fillCompose();
    fireEvent.change(screen.getByLabelText(/Hourly Limit/), { target: { value: "0" } });
    submitForm();

    expect(screen.getByText("Hourly limit must be greater than zero.")).toBeTruthy();
    expect(mockScheduleEmails).not.toHaveBeenCalled();
  });

  it("schedules emails with the delay expressed in seconds", async () => {
    render(<ComposePage />);
    fillCompose();
    fireEvent.change(screen.getByLabelText(/Delay between/), { target: { value: "3" } });
    submitForm();

    expect(mockScheduleEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Hello",
        body: "World",
        recipients: ["alice@example.com", "bob@example.com"],
        delayBetweenEmails: 3,
        hourlyLimit: 100
      })
    );
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/scheduled", { replace: true });
    });
  });

  it("shows the scheduled count on success", async () => {
    render(<ComposePage />);
    fillCompose();
    submitForm();

    expect(await screen.findByText("2 emails scheduled successfully.")).toBeTruthy();
  });
});
