#!/usr/bin/env python3
"""Tests for file_organizer.py — automated file organization and retrieval."""

import argparse
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# Ensure tools/ is on the path
sys.path.insert(0, os.path.dirname(__file__))

import file_organizer as fo


class TestCategoryClassification(unittest.TestCase):
    """Tests for auto-category detection."""

    def test_proposal_by_filename(self):
        self.assertEqual(fo.classify_category("project_proposal_v2.pdf", ""), "proposal")

    def test_proposal_by_content(self):
        content = "We propose the following scope of work with timeline and pricing."
        self.assertEqual(fo.classify_category("document.txt", content), "proposal")

    def test_contract_by_filename(self):
        self.assertEqual(fo.classify_category("service_agreement.docx", ""), "contract")

    def test_contract_by_content(self):
        content = "This agreement is entered into by the parties. Terms and conditions apply."
        self.assertEqual(fo.classify_category("doc.txt", content), "contract")

    def test_invoice_by_filename(self):
        self.assertEqual(fo.classify_category("INV-2024-001.pdf", ""), "invoice")

    def test_invoice_by_content(self):
        content = "Invoice Number: 1234. Amount due: $5,000. Payment due within net 30."
        self.assertEqual(fo.classify_category("doc.txt", content), "invoice")

    def test_deliverable_by_extension(self):
        self.assertEqual(fo.classify_category("design_final.psd", ""), "deliverable")

    def test_deliverable_by_extension_image(self):
        self.assertEqual(fo.classify_category("logo.png", ""), "deliverable")

    def test_communication_by_content(self):
        content = "Meeting notes from call. Action items: follow-up on feedback."
        self.assertEqual(fo.classify_category("notes.txt", content), "communication")

    def test_brief_by_content(self):
        content = "Project brief: requirements and specification for the new website."
        self.assertEqual(fo.classify_category("doc.txt", content), "brief")

    def test_report_by_filename(self):
        self.assertEqual(fo.classify_category("weekly_report.docx", ""), "report")

    def test_receipt_by_content(self):
        content = "Receipt: Payment received. Thank you for your payment of $500."
        self.assertEqual(fo.classify_category("doc.txt", content), "receipt")

    def test_misc_fallback(self):
        self.assertEqual(fo.classify_category("random_file.bin", ""), "misc")

    def test_asset_by_extension(self):
        self.assertEqual(fo.classify_category("font.ttf", ""), "asset")

    def test_filename_weight_over_content(self):
        # Filename match should outweigh content if both match different categories
        content = "This is a report with analysis."
        result = fo.classify_category("proposal_draft.txt", content)
        self.assertEqual(result, "proposal")


class TestAutoTagging(unittest.TestCase):
    """Tests for automatic tag generation."""

    def test_includes_category(self):
        tags = fo.auto_generate_tags("file.txt", "", "proposal")
        self.assertIn("proposal", tags)

    def test_format_tag_pdf(self):
        tags = fo.auto_generate_tags("file.pdf", "", "invoice")
        self.assertIn("pdf", tags)

    def test_format_tag_image(self):
        tags = fo.auto_generate_tags("logo.png", "", "deliverable")
        self.assertIn("image", tags)

    def test_status_tag_draft(self):
        tags = fo.auto_generate_tags("draft_v1.txt", "This is a draft document", "deliverable")
        self.assertIn("draft", tags)

    def test_status_tag_final(self):
        tags = fo.auto_generate_tags("approved_final.docx", "Final approved version", "deliverable")
        self.assertIn("final", tags)

    def test_status_tag_urgent(self):
        tags = fo.auto_generate_tags("file.txt", "URGENT: need this ASAP", "communication")
        self.assertIn("urgent", tags)

    def test_no_duplicates(self):
        tags = fo.auto_generate_tags("draft_draft.txt", "draft draft draft", "deliverable")
        self.assertEqual(len(tags), len(set(tags)))


class TestFuzzyMatch(unittest.TestCase):
    """Tests for fuzzy matching."""

    def test_exact_match(self):
        self.assertEqual(fo.fuzzy_match("invoice", "invoice"), 1.0)

    def test_substring_match(self):
        self.assertGreaterEqual(fo.fuzzy_match("inv", "invoice"), 0.9)

    def test_similar_strings(self):
        score = fo.fuzzy_match("invoce", "invoice")
        self.assertGreaterEqual(score, 0.5)

    def test_different_strings(self):
        score = fo.fuzzy_match("apple", "zebra")
        self.assertLess(score, 0.3)

    def test_empty_strings(self):
        self.assertEqual(fo.fuzzy_match("", "test"), 0.0)
        self.assertEqual(fo.fuzzy_match("test", ""), 0.0)

    def test_case_insensitive(self):
        self.assertEqual(fo.fuzzy_match("Invoice", "invoice"), 1.0)


class TestSearch(unittest.TestCase):
    """Tests for full-text search."""

    def setUp(self):
        self.entries = [
            {
                "id": "aaa111", "filename": "proposal_acme.pdf",
                "category": "proposal", "tags": ["proposal", "pdf", "draft"],
                "client": "Acme Corp", "project": "website",
                "status": "active", "content_searchable": "website redesign proposal with timeline",
                "size_bytes": 1000,
            },
            {
                "id": "bbb222", "filename": "invoice_001.pdf",
                "category": "invoice", "tags": ["invoice", "pdf"],
                "client": "Acme Corp", "project": "website",
                "status": "active", "content_searchable": "invoice for website development services",
                "size_bytes": 500,
            },
            {
                "id": "ccc333", "filename": "meeting_notes.md",
                "category": "communication", "tags": ["communication", "markdown"],
                "client": "Beta Inc", "project": "app",
                "status": "active", "content_searchable": "discussed timeline and deliverables",
                "size_bytes": 200,
            },
            {
                "id": "ddd444", "filename": "old_contract.pdf",
                "category": "contract", "tags": ["contract", "pdf"],
                "client": "Old Client", "project": "",
                "status": "deleted", "content_searchable": "old contract terms",
                "size_bytes": 300,
            },
        ]

    def test_search_by_filename(self):
        results = fo.search_files(self.entries, "proposal")
        self.assertTrue(len(results) > 0)
        self.assertEqual(results[0][0]["id"], "aaa111")

    def test_search_by_content(self):
        results = fo.search_files(self.entries, "timeline")
        self.assertTrue(len(results) >= 2)

    def test_search_filter_category(self):
        results = fo.search_files(self.entries, "pdf", category="invoice")
        self.assertTrue(all(r[0]["category"] == "invoice" for r in results))

    def test_search_filter_client(self):
        results = fo.search_files(self.entries, "website", client="Acme Corp")
        self.assertTrue(all(r[0]["client"] == "Acme Corp" for r in results))

    def test_search_filter_tag(self):
        results = fo.search_files(self.entries, "website", tag="draft")
        self.assertTrue(len(results) > 0)

    def test_search_excludes_deleted(self):
        results = fo.search_files(self.entries, "contract")
        ids = [r[0]["id"] for r in results]
        self.assertNotIn("ddd444", ids)

    def test_search_no_results(self):
        results = fo.search_files(self.entries, "xyznonexistent")
        self.assertEqual(len(results), 0)

    def test_search_scoring_filename_higher(self):
        results = fo.search_files(self.entries, "invoice")
        # invoice in filename should score higher than invoice only in content
        self.assertEqual(results[0][0]["id"], "bbb222")


class TestFolderStructure(unittest.TestCase):
    """Tests for folder structure generation."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self._orig_managed = fo.MANAGED_ROOT
        fo.MANAGED_ROOT = os.path.join(self.tmp, "managed")

    def tearDown(self):
        fo.MANAGED_ROOT = self._orig_managed
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_create_structure(self):
        base = fo.create_folder_structure("Acme Corp", "Website Redesign")
        self.assertTrue(os.path.isdir(base))
        for folder in fo.STANDARD_FOLDERS:
            self.assertTrue(os.path.isdir(os.path.join(base, folder)))

    def test_safe_directory_names(self):
        base = fo.get_client_project_dir("Acme Corp!!", "My Project #1")
        self.assertNotIn("!", base)
        self.assertNotIn("#", base)

    def test_no_project(self):
        base = fo.get_client_project_dir("Solo Client")
        self.assertIn("solo_client", base)
        self.assertNotIn("//", base)


class TestFileEntry(unittest.TestCase):
    """Tests for FileEntry dataclass."""

    def test_to_dict_roundtrip(self):
        entry = fo.FileEntry(
            id="test123", original_path="/tmp/test.txt",
            managed_path="/managed/test.txt", filename="test.txt",
            extension=".txt", category="misc", tags=["test"],
            client="Test", project="Demo", status="active",
            size_bytes=100, content_preview="hello",
            content_searchable="hello world",
            created_at="2024-01-01T00:00:00", updated_at="2024-01-01T00:00:00",
        )
        d = entry.to_dict()
        restored = fo.FileEntry.from_dict(d)
        self.assertEqual(entry.id, restored.id)
        self.assertEqual(entry.filename, restored.filename)
        self.assertEqual(entry.tags, restored.tags)

    def test_from_dict_ignores_extra_keys(self):
        d = {
            "id": "x", "original_path": "", "managed_path": "",
            "filename": "f.txt", "extension": ".txt", "category": "misc",
            "tags": [], "client": "", "project": "", "status": "active",
            "size_bytes": 0, "content_preview": "", "content_searchable": "",
            "created_at": "", "updated_at": "", "extra_field": "ignored",
        }
        entry = fo.FileEntry.from_dict(d)
        self.assertEqual(entry.id, "x")


class TestStorageIntegration(unittest.TestCase):
    """Integration tests for index persistence."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self._orig_data = fo.DATA_DIR
        self._orig_index = fo.INDEX_FILE
        self._orig_tags = fo.TAGS_FILE
        self._orig_archive = fo.ARCHIVE_DIR
        self._orig_managed = fo.MANAGED_ROOT
        fo.DATA_DIR = self.tmp
        fo.INDEX_FILE = os.path.join(self.tmp, "file_index.json")
        fo.TAGS_FILE = os.path.join(self.tmp, "tags.json")
        fo.ARCHIVE_DIR = os.path.join(self.tmp, "archive")
        fo.MANAGED_ROOT = os.path.join(self.tmp, "managed")

    def tearDown(self):
        fo.DATA_DIR = self._orig_data
        fo.INDEX_FILE = self._orig_index
        fo.TAGS_FILE = self._orig_tags
        fo.ARCHIVE_DIR = self._orig_archive
        fo.MANAGED_ROOT = self._orig_managed
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_save_and_load_index(self):
        entries = [{"id": "abc", "filename": "test.txt"}]
        fo.save_index(entries)
        loaded = fo.load_index()
        self.assertEqual(loaded, entries)

    def test_save_and_load_tags(self):
        tags = {"invoice": {"name": "invoice", "color": "", "file_count": 3, "created_at": ""}}
        fo.save_tags(tags)
        loaded = fo.load_tags()
        self.assertEqual(loaded, tags)

    def test_load_missing_index(self):
        self.assertEqual(fo.load_index(), [])

    def test_load_missing_tags(self):
        self.assertEqual(fo.load_tags(), {})

    def test_ingest_file(self):
        """Test ingesting a single text file."""
        # Create a test file
        test_file = os.path.join(self.tmp, "test_proposal.txt")
        with open(test_file, "w") as f:
            f.write("We propose a new website redesign with timeline and pricing.")

        fo.ensure_dirs()
        fo.save_index([])
        fo.save_tags({})

        args = argparse.Namespace(
            path=test_file, client="TestClient", project="WebProject"
        )
        fo.cmd_ingest(args)

        entries = fo.load_index()
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]["filename"], "test_proposal.txt")
        self.assertEqual(entries[0]["category"], "proposal")
        self.assertEqual(entries[0]["client"], "TestClient")
        self.assertEqual(entries[0]["status"], "active")
        self.assertTrue(os.path.exists(entries[0]["managed_path"]))

    def test_ingest_directory(self):
        """Test ingesting a directory of files."""
        src_dir = os.path.join(self.tmp, "source")
        os.makedirs(src_dir)
        for name in ["proposal.txt", "invoice.txt", "notes.md"]:
            with open(os.path.join(src_dir, name), "w") as f:
                f.write(f"Content for {name}")

        fo.ensure_dirs()
        fo.save_index([])
        fo.save_tags({})

        args = argparse.Namespace(path=src_dir, client="Client1", project="Proj1")
        fo.cmd_ingest(args)

        entries = fo.load_index()
        self.assertEqual(len(entries), 3)

    def test_ingest_skip_duplicates(self):
        """Test that re-ingesting the same file is skipped."""
        test_file = os.path.join(self.tmp, "dup.txt")
        with open(test_file, "w") as f:
            f.write("content")

        fo.ensure_dirs()
        fo.save_index([])
        fo.save_tags({})

        args = argparse.Namespace(path=test_file, client="C", project="P")
        fo.cmd_ingest(args)
        fo.cmd_ingest(args)

        entries = fo.load_index()
        self.assertEqual(len(entries), 1)

    def test_archive_files(self):
        """Test archiving files for a client."""
        test_file = os.path.join(self.tmp, "to_archive.txt")
        with open(test_file, "w") as f:
            f.write("content")

        fo.ensure_dirs()
        fo.save_index([])
        fo.save_tags({})

        # Ingest first
        args = argparse.Namespace(path=test_file, client="ArchiveClient", project="Done")
        fo.cmd_ingest(args)

        # Archive
        args = argparse.Namespace(client="ArchiveClient", project="Done")
        fo.cmd_archive(args)

        entries = fo.load_index()
        self.assertEqual(entries[0]["status"], "archived")
        self.assertIsNotNone(entries[0].get("archived_at"))

    def test_tag_and_untag(self):
        """Test adding and removing tags."""
        fo.ensure_dirs()
        fo.save_index([{
            "id": "tag_test_id", "filename": "f.txt", "tags": ["misc"],
            "status": "active", "updated_at": "",
        }])
        fo.save_tags({})

        args = argparse.Namespace(file_id="tag_test_id", tags=["important", "client-a"])
        fo.cmd_tag(args)

        entries = fo.load_index()
        self.assertIn("important", entries[0]["tags"])
        self.assertIn("client-a", entries[0]["tags"])

        args = argparse.Namespace(file_id="tag_test_id", tags=["important"])
        fo.cmd_untag(args)

        entries = fo.load_index()
        self.assertNotIn("important", entries[0]["tags"])
        self.assertIn("client-a", entries[0]["tags"])


class TestHelpers(unittest.TestCase):
    """Tests for helper functions."""

    def test_fmt_size_bytes(self):
        self.assertEqual(fo.fmt_size(500), "500B")

    def test_fmt_size_kb(self):
        self.assertIn("KB", fo.fmt_size(2048))

    def test_fmt_size_mb(self):
        self.assertIn("MB", fo.fmt_size(5 * 1024 * 1024))

    def test_fmt_date(self):
        result = fo.fmt_date("2024-06-15T10:30:00")
        self.assertIn("2024-06-15", result)

    def test_fmt_date_invalid(self):
        result = fo.fmt_date("not-a-date")
        self.assertEqual(result, "not-a-date")

    def test_find_entry_by_prefix(self):
        entries = [{"id": "abcdef123456"}, {"id": "xyz789000000"}]
        self.assertEqual(fo._find_entry(entries, "abcdef")["id"], "abcdef123456")

    def test_find_entry_not_found(self):
        entries = [{"id": "abcdef123456"}]
        self.assertIsNone(fo._find_entry(entries, "zzz"))

    def test_extract_text_readable(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False)
        tmp.write("hello world")
        tmp.close()
        content = fo.extract_text_content(tmp.name)
        self.assertEqual(content, "hello world")
        os.unlink(tmp.name)

    def test_extract_text_binary_skipped(self):
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(b"\x89PNG\r\n")
        tmp.close()
        content = fo.extract_text_content(tmp.name)
        self.assertEqual(content, "")
        os.unlink(tmp.name)


class TestCategoryFolderMap(unittest.TestCase):
    """Tests for category to folder mapping."""

    def test_all_categories_mapped(self):
        for cat in fo.CATEGORIES:
            self.assertIn(cat, fo.CATEGORY_FOLDER_MAP,
                          f"Category '{cat}' missing from CATEGORY_FOLDER_MAP")


if __name__ == "__main__":
    unittest.main()
