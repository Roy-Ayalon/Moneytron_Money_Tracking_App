# server/email_util.py
"""
Email sending for the feedback feature.
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from storage import USERS_DIR

logger = logging.getLogger("moneytron")

FEEDBACK_TARGET_EMAIL = "roy1.ayalon@gmail.com"
FEEDBACK_FILE = USERS_DIR / "_feedback.json"


def _send_feedback_email(from_email: str, name: str, message: str) -> bool:
    """Try to send feedback email via SMTP. Returns True on success."""
    if not from_email:
        return False
    try:
        smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")

        msg = MIMEMultipart()
        msg["From"] = smtp_user
        msg["To"] = FEEDBACK_TARGET_EMAIL
        msg["Subject"] = f"MoneyTron Feedback from {name}"
        msg["Reply-To"] = from_email

        body = f"From: {name}\nEmail: {from_email}\n\n{message}"
        msg.attach(MIMEText(body, "plain", "utf-8"))

        if smtp_user and smtp_pass:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            logger.info(f"Feedback email sent from {from_email} to {FEEDBACK_TARGET_EMAIL}")
            return True
        else:
            try:
                with smtplib.SMTP("localhost", 25, timeout=5) as server:
                    server.send_message(msg)
                logger.info(f"Feedback email sent via localhost from {from_email}")
                return True
            except Exception:
                logger.warning("No SMTP credentials configured and localhost mail not available")
                return False
    except Exception as e:
        logger.error(f"Failed to send feedback email: {e}")
        return False
