from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from typing import ClassVar as _ClassVar

DESCRIPTOR: _descriptor.FileDescriptor

class ActionType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    unspecified: _ClassVar[ActionType]
    set_cursor: _ClassVar[ActionType]
    clear_cursor: _ClassVar[ActionType]
    click: _ClassVar[ActionType]
    type: _ClassVar[ActionType]
    hover: _ClassVar[ActionType]
    drag: _ClassVar[ActionType]
    scroll_to: _ClassVar[ActionType]
    viewport_transition: _ClassVar[ActionType]
unspecified: ActionType
set_cursor: ActionType
clear_cursor: ActionType
click: ActionType
type: ActionType
hover: ActionType
drag: ActionType
scroll_to: ActionType
viewport_transition: ActionType
