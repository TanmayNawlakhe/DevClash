import logging
import sys
from typing import Optional


_LOGGER_CONFIGURED = False


def _configure_root_logger(level: str = "INFO") -> None:
    global _LOGGER_CONFIGURED
    if _LOGGER_CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(filename)s:%(lineno)d:%(levelname)s:%(message)s")
    )

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level.upper())

    _LOGGER_CONFIGURED = True


def get_logger(name: Optional[str] = None, level: str = "INFO") -> logging.Logger:
    _configure_root_logger(level=level)
    logger = logging.getLogger(name)
    logger.setLevel(level.upper())
    return logger
