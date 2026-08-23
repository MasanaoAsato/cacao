#!/usr/bin/env python3
"""Validate stable structural rules for HTML implementation designs."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path


VAGUE_PHRASES = (
    "適切に処理",
    "必要に応じて",
    "状況に応じて",
    "いい感じに",
    "as appropriate",
    "if necessary",
)
SOURCE_LINE_REFERENCE = re.compile(
    r"(?:[\w.-]+/)*[\w.-]+\.(?:go|rs|py|js|jsx|ts|tsx|java|kt|rb|php|sql|ya?ml|json|toml):\d+"
)


@dataclass
class Section:
    identifier: str
    body_text: list[str] = field(default_factory=list)


class DesignHTMLParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.ids: list[str] = []
        self.anchor_targets: list[str] = []
        self.h1_count = 0
        self.h2_texts: list[str] = []
        self.deep_headings: list[str] = []
        self.title_parts: list[str] = []
        self.lang = ""
        self.has_script = False
        self.sections: list[Section] = []
        self._section_stack: list[Section] = []
        self._heading_stack: list[tuple[str, list[str]]] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        identifier = attributes.get("id")
        if identifier:
            self.ids.append(identifier)

        href = attributes.get("href")
        if href and href.startswith("#") and len(href) > 1:
            self.anchor_targets.append(href[1:])

        if tag == "html":
            self.lang = attributes.get("lang") or ""
        elif tag == "script":
            self.has_script = True
        elif tag == "title":
            self._in_title = True
        elif tag == "section":
            section = Section(identifier or "(section without id)")
            self.sections.append(section)
            self._section_stack.append(section)

        if re.fullmatch(r"h[1-6]", tag):
            self._heading_stack.append((tag, []))
            if tag == "h1":
                self.h1_count += 1

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

        if self._heading_stack and self._heading_stack[-1][0] == tag:
            heading_tag, parts = self._heading_stack.pop()
            text = " ".join("".join(parts).split())
            if heading_tag == "h2":
                self.h2_texts.append(text)
            elif heading_tag in {"h4", "h5", "h6"}:
                self.deep_headings.append(text or heading_tag)

        if tag == "section" and self._section_stack:
            self._section_stack.pop()

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        if self._heading_stack:
            self._heading_stack[-1][1].append(data)
        else:
            for section in self._section_stack:
                section.body_text.append(data)


def validate_file(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []

    if path.suffix.lower() != ".html":
        errors.append("design file must use the .html extension")
    if ".design" not in path.parts:
        errors.append("design file must be stored under a .design directory")
    if not path.is_file():
        return [*errors, "file does not exist or is not a regular file"], warnings

    source = path.read_text(encoding="utf-8")
    if not re.match(r"\s*<!doctype\s+html\s*>", source, flags=re.IGNORECASE):
        errors.append("missing <!doctype html>")

    parser = DesignHTMLParser()
    try:
        parser.feed(source)
        parser.close()
    except Exception as exc:  # HTMLParser errors are rare but should be actionable.
        errors.append(f"HTML parsing failed: {exc}")
        return errors, warnings

    title = " ".join("".join(parser.title_parts).split())
    if not parser.lang.strip():
        errors.append("the html element must declare a language")
    if not title:
        errors.append("the title element must contain a descriptive title")
    if parser.h1_count != 1:
        errors.append(f"expected exactly one h1, found {parser.h1_count}")

    normalized_h2 = {heading.casefold() for heading in parser.h2_texts}
    for required in ("goal", "design"):
        if required not in normalized_h2:
            errors.append(f"missing required h2 heading: {required.title()}")

    duplicate_ids = sorted({identifier for identifier in parser.ids if parser.ids.count(identifier) > 1})
    if duplicate_ids:
        errors.append(f"duplicate id values: {', '.join(duplicate_ids)}")

    missing_targets = sorted(set(parser.anchor_targets) - set(parser.ids))
    if missing_targets:
        errors.append(f"anchor links target missing ids: {', '.join(missing_targets)}")
    if parser.has_script:
        warnings.append("script element found; keep JavaScript only when an established repository format requires it")

    for section in parser.sections:
        content = " ".join("".join(section.body_text).split())
        if not content:
            errors.append(f"empty section: {section.identifier}")
        elif content.casefold() in {"該当なし", "なし", "n/a", "not applicable"}:
            errors.append(f"not-applicable-only section: {section.identifier}")

    if "{{" in source or "}}" in source:
        errors.append("unresolved template placeholder found")
    if "template comment" in source.casefold() or "add only" in source.casefold():
        warnings.append("possible template instruction remains in the document")
    if parser.deep_headings:
        warnings.append("heading depth exceeds h3: " + ", ".join(parser.deep_headings))

    lowered_source = source.casefold()
    used_vague_phrases = [phrase for phrase in VAGUE_PHRASES if phrase.casefold() in lowered_source]
    if used_vague_phrases:
        warnings.append("possible deferred decisions: " + ", ".join(used_vague_phrases))

    line_references = sorted(set(SOURCE_LINE_REFERENCE.findall(source)))
    if line_references:
        warnings.append("fragile source line references: " + ", ".join(line_references))

    return errors, warnings


def main() -> int:
    argument_parser = argparse.ArgumentParser(
        description="Validate structural rules for implementation-design HTML files."
    )
    argument_parser.add_argument("files", nargs="+", type=Path)
    args = argument_parser.parse_args()

    failed = False
    for path in args.files:
        errors, warnings = validate_file(path)
        print(f"{path}:")
        for message in errors:
            print(f"  ERROR: {message}")
        for message in warnings:
            print(f"  WARN: {message}")
        if not errors and not warnings:
            print("  OK")
        failed = failed or bool(errors)

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
