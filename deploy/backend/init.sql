-- =============================================================================
--  数据库初始化脚本（只建库建表，不含任何账号数据）
--
--  执行时机：MySQL 容器【第一次启动】且数据目录为空时自动执行。
--  之后再改这个文件不会重新跑；想重建：docker compose down -v && docker compose up -d
--
--  朋友第一次登录：打开网页直接点注册，注册的账号就在这张表里。
--  如果想自带一批测试账号，把带数据的完整 dump 放到 docker-entrypoint-initdb.d/
--  目录（需在 docker-compose.yml 里加挂载），或者在网页上注册。
-- =============================================================================

-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: go-net
-- ------------------------------------------------------
-- Server version	8.0.46-0ubuntu0.24.04.3

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `go-net`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `go-net` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `go-net`;

--
-- Table structure for table `friends`
--

DROP TABLE IF EXISTS `friends`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `friends` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT '用户id',
  `friend_id` int NOT NULL COMMENT '好友id',
  `status` tinyint(1) DEFAULT '0' COMMENT '0-待确认, 1-已确认, 2-已拒绝, 3-已删除',
  `remark` varchar(50) DEFAULT '' COMMENT '备注名',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_friend` (`user_id`,`friend_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_friend_id` (`friend_id`),
  CONSTRAINT `fk_commenets_friend_id` FOREIGN KEY (`friend_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_commenets_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `group_chats`
--

DROP TABLE IF EXISTS `group_chats`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_chats` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `owner_id` bigint NOT NULL COMMENT '群主ID',
  `name` varchar(255) DEFAULT '' COMMENT '群名称',
  `avatar` varchar(255) DEFAULT '' COMMENT '群头像',
  `notice` varchar(255) DEFAULT '' COMMENT '群公告',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `encrypted` tinyint(1) DEFAULT '0' COMMENT '是否加密',
  `is_muted` tinyint(1) DEFAULT '0' COMMENT '是否全员禁言 0-否 1-是',
  PRIMARY KEY (`id`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='群组表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `group_members`
--

DROP TABLE IF EXISTS `group_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_members` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `group_id` bigint NOT NULL COMMENT '群ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `role` tinyint(1) DEFAULT '0' COMMENT '角色 0-成员 1-管理员 2-群主',
  `joined_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_muted` tinyint(1) DEFAULT '0' COMMENT '该用户是否被禁言 0-否 1-是',
  `is_notify_disabled` tinyint(1) DEFAULT '0' COMMENT '该用户是否关闭该群通知 0-否 1-是',
  `status` tinyint(1) DEFAULT '0' COMMENT '该群员状态 0-正常 1-退群(自己退、被踢出)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_group_user` (`group_id`,`user_id`),
  KEY `idx_group_id` (`group_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='群成员表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `sender_id` int NOT NULL COMMENT '发送者ID',
  `receiver_id` int NOT NULL COMMENT '接收者ID',
  `elements` json NOT NULL COMMENT '消息内容元素列表',
  `status` tinyint(1) DEFAULT '0' COMMENT '0-未读, 1-已读',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `type` tinyint(1) DEFAULT '1' COMMENT '通信渠道: 0 好友通信; 1 群组通信',
  PRIMARY KEY (`id`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_receiver_id` (`receiver_id`)
) ENGINE=InnoDB AUTO_INCREMENT=115 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='消息表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `moments`
--

DROP TABLE IF EXISTS `moments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moments` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '朋友圈id',
  `owner_id` bigint NOT NULL COMMENT '朋友圈发布者id',
  `elements` json NOT NULL COMMENT '朋友圈文字内容',
  `status` tinyint DEFAULT '0' COMMENT '朋友圈状态，0-正常，1-删除',
  `like_count` int DEFAULT '0' COMMENT '点赞数',
  `visible` int DEFAULT '0' COMMENT '可见性，0-公开，1-好友可见，2-仅自己可见 3-部分好友可见',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='朋友圈表;内容主题';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `moments_comments`
--

DROP TABLE IF EXISTS `moments_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moments_comments` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '评论id',
  `moment_id` bigint NOT NULL COMMENT '朋友圈id',
  `user_id` bigint NOT NULL COMMENT '评论者id',
  `status` tinyint DEFAULT '0' COMMENT '评论状态，0-正常，1-删除',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `elements` json NOT NULL COMMENT '评论元素',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='朋友圈评论表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `moments_likes`
--

DROP TABLE IF EXISTS `moments_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moments_likes` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '点赞id',
  `moment_id` bigint NOT NULL COMMENT '朋友圈id',
  `user_id` bigint NOT NULL COMMENT '点赞者id',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_moment_user` (`moment_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='朋友圈点赞表;记录谁给谁的朋友圈点赞';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `moments_privacy`
--

DROP TABLE IF EXISTS `moments_privacy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moments_privacy` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '隐私设置id',
  `user_id` bigint NOT NULL COMMENT '用户id',
  `target_id` bigint NOT NULL COMMENT '目标用户id',
  `hide_their` tinyint DEFAULT '0' COMMENT '我不看TA的朋友圈，0-不屏蔽，1-屏蔽',
  `hide_mine` tinyint DEFAULT '0' COMMENT '不让TA看我的朋友圈，0-不屏蔽，1-屏蔽',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_target` (`user_id`,`target_id`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='朋友圈隐私表;记录谁屏蔽谁的朋友圈';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `moments_visible`
--

DROP TABLE IF EXISTS `moments_visible`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `moments_visible` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '朋友圈id',
  `moment_id` bigint NOT NULL COMMENT '朋友圈id',
  `user_id` bigint NOT NULL COMMENT '用户 id',
  `visible` int DEFAULT '0' COMMENT '0 该好友可见,1 该好友不可见;需要配合coments.visible = 3 的情况',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_moment_user` (`moment_id`,`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='该条记录谁可见；谁不可见表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `time_comments`
--

DROP TABLE IF EXISTS `time_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `time_comments` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '评论id',
  `time_line_id` bigint NOT NULL COMMENT '时间线id',
  `owner_id` int NOT NULL COMMENT '评论者id',
  `elements` json NOT NULL COMMENT '时间线内容',
  `status` tinyint DEFAULT '0' COMMENT '评论状态，0-正常，1-删除',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_time_line_id` (`time_line_id`),
  KEY `idx_owner_id` (`owner_id`),
  CONSTRAINT `fk_commenets_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_comments_time_line` FOREIGN KEY (`time_line_id`) REFERENCES `time_lines` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_comments_status` CHECK ((`status` in (0,1)))
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='时间线表;记录用户的时间线信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `time_likes`
--

DROP TABLE IF EXISTS `time_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `time_likes` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '点赞id',
  `time_line_id` bigint NOT NULL COMMENT '时间线id',
  `owner_id` int NOT NULL COMMENT '点赞者id',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_time_line_id_owner_id` (`time_line_id`,`owner_id`),
  KEY `idx_time_line_id` (`time_line_id`),
  KEY `idx_owner_id` (`owner_id`),
  CONSTRAINT `fk_likes_owner` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_likes_time_line` FOREIGN KEY (`time_line_id`) REFERENCES `time_lines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='时间线;点赞表';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `time_lines`
--

DROP TABLE IF EXISTS `time_lines`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `time_lines` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '时间线ID',
  `owner_id` int NOT NULL COMMENT '时间线发布者id',
  `elements` json NOT NULL COMMENT '时间线内容',
  `like_count` int DEFAULT '0' COMMENT '点赞数',
  `status` tinyint DEFAULT '0' COMMENT '时间线状态，0-正常，1-删除,2-被举报中,3-举报成功,4-举报失败',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_owner_id` (`owner_id`),
  CONSTRAINT `fk_time_line_owner_id` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_like_count` CHECK ((`like_count` >= 0))
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='时间线表;记录用户的时间线信息';
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `avatar` varchar(255) DEFAULT NULL COMMENT '用户头像hash',
  `nickname` varchar(255) DEFAULT NULL COMMENT '用户中文名称',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
--

/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-22 21:49:03
