class DomainError(Exception):
    """An expected workflow failure, translated to HTTP by the API boundary."""

    def __init__(self, kind: str, message: str):
        super().__init__(message)
        self.kind = kind
        self.message = message
