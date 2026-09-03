//go:build !unix && !windows

package fsstore

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
