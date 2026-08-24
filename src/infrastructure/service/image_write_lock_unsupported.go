//go:build !linux && !darwin && !windows && !dragonfly && !freebsd && !netbsd && !openbsd

package service

import (
	"fmt"
	"os"
)

func tryLockImageFile(_ *os.File) (bool, error) {
	return false, fmt.Errorf("image write locking is unsupported on this platform")
}

func unlockImageFile(_ *os.File) error {
	return nil
}
