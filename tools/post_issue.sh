#!/usr/bin/env bash
# 자동 점검 결과를 이슈 하나로 모은다(2026-11-05). 쓰는 곳: .github/workflows/*-watch.yml
#   post_issue.sh "<이슈 제목>" <결과 파일>
# 파일이 있으면: 열린 이슈가 없을 때 새로 열고(GitHub가 저장소 주인에게 메일을 보낸다), 내용이 달라졌을 때만 고쳐서 댓글로 알린다. 같은 내용을 매주 다시 알리지 않는다.
# 파일이 없으면: 문제가 없다는 뜻이라 열린 이슈를 닫는다.
# 관리자 화면 '최신화 점검'이 이 라벨이 붙은 열린 이슈 수를 보여 준다(public/app.js).
set -eu
title="$1"
file="$2"
label="자동 점검"

gh label create "$label" --color FBCA04 --description "매주 도는 자동 점검이 연 이슈" --force >/dev/null
num="$(gh issue list --state open --label "$label" --limit 50 --json number,title --jq ".[] | select(.title == \"$title\") | .number" | head -n 1)"

if [ ! -f "$file" ]; then
  if [ -n "$num" ]; then
    gh issue close "$num" --comment "이번 점검에서는 문제가 없어요."
  fi
  exit 0
fi

if [ -z "$num" ]; then
  gh issue create --title "$title" --label "$label" --body-file "$file"
  exit 0
fi

if [ "$(gh issue view "$num" --json body --jq .body)" != "$(cat "$file")" ]; then
  gh issue edit "$num" --body-file "$file"
  gh issue comment "$num" --body "점검 결과가 달라져서 위 내용을 고쳤어요."
fi
